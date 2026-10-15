import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The entrypoint is the wrapper's security contract: it must refuse to start
 * unless both credentials resolve to non-empty values, and it must never echo
 * credential material to stderr. It is a POSIX shell script, so these run only
 * where a real /bin/sh exists.
 */
const ENTRYPOINT = join(process.cwd(), "docker-entrypoint.sh");
const skipReason =
  process.platform === "win32"
    ? "requires a POSIX shell"
    : !existsSync(ENTRYPOINT)
      ? "docker-entrypoint.sh not found relative to the repo root"
      : false;

/** Run the entrypoint with a deliberately minimal environment. */
function runEntrypoint(env: Record<string, string>) {
  return spawnSync("sh", [ENTRYPOINT], {
    env: { PATH: "/usr/bin:/bin", ...env },
    encoding: "utf8",
  });
}

/** Create a temp dir holding named secret files; returns its path. */
function withSecretFiles(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "docmost-mcp-test-"));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

describe("docker-entrypoint.sh", { skip: skipReason }, () => {
  it("refuses to start without DOCMOST_API_URL", () => {
    const result = runEntrypoint({});
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /DOCMOST_API_URL is not set/);
  });

  it("refuses to start when the email secret file is missing", () => {
    const dir = withSecretFiles({ password: "hunter2" });
    try {
      const result = runEntrypoint({
        DOCMOST_API_URL: "https://docs.test/api",
        DOCMOST_EMAIL_FILE: join(dir, "missing-email"),
        DOCMOST_PASSWORD_FILE: join(dir, "password"),
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /DOCMOST_EMAIL not available/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses to start when the password secret file is missing", () => {
    const dir = withSecretFiles({ email: "bot@test" });
    try {
      const result = runEntrypoint({
        DOCMOST_API_URL: "https://docs.test/api",
        DOCMOST_EMAIL_FILE: join(dir, "email"),
        DOCMOST_PASSWORD_FILE: join(dir, "missing-password"),
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /DOCMOST_PASSWORD not available/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses to start on an empty secret file", () => {
    const dir = withSecretFiles({ email: "", password: "hunter2" });
    try {
      const result = runEntrypoint({
        DOCMOST_API_URL: "https://docs.test/api",
        DOCMOST_EMAIL_FILE: join(dir, "email"),
        DOCMOST_PASSWORD_FILE: join(dir, "password"),
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /DOCMOST_EMAIL resolved to an empty value/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses to start on a whitespace-only secret file", () => {
    const dir = withSecretFiles({ email: "bot@test", password: "   \n\t " });
    try {
      const result = runEntrypoint({
        DOCMOST_API_URL: "https://docs.test/api",
        DOCMOST_EMAIL_FILE: join(dir, "email"),
        DOCMOST_PASSWORD_FILE: join(dir, "password"),
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /DOCMOST_PASSWORD resolved to an empty value/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("never echoes credential material while refusing to start", () => {
    const dir = withSecretFiles({ email: "SENTINEL-EMAIL@example.test" });
    try {
      const result = runEntrypoint({
        DOCMOST_API_URL: "https://docs.test/api",
        DOCMOST_EMAIL_FILE: join(dir, "email"),
        DOCMOST_PASSWORD_FILE: join(dir, "missing-password"),
      });
      assert.notEqual(result.status, 0);
      assert.ok(
        !result.stderr.includes("SENTINEL-EMAIL"),
        `credential leaked into stderr: ${result.stderr}`,
      );
      assert.ok(
        !result.stdout.includes("SENTINEL-EMAIL"),
        `credential leaked into stdout: ${result.stdout}`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});