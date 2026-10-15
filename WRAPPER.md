# Docmost MCP Wrapper

Dockerized deployment wrapper for [MrMartiniMo/docmost-mcp](https://github.com/MrMartiniMo/docmost-mcp) with file-based secrets and network exposure via Tailscale.

## Why this fork exists

Upstream `docmost-mcp` reads credentials directly from environment variables (`DOCMOST_EMAIL`, `DOCMOST_PASSWORD`), which exposes secrets in `docker inspect` output when set via `-e`/`--env` flags or Dockerfile `ENV`. This wrapper adds a secure entrypoint that:

1. Reads credentials from **file mounts only** (never from env vars or CLI flags)
2. Validates all inputs before starting — refuses to start with empty or missing secrets
3. Never logs secret values, even on auth failure
4. Exports secrets into the child process environment only (transient, not visible in `docker inspect`)

Additionally, upstream `docmost-mcp` speaks **stdio transport only** — it must be spawned as a local subprocess by an MCP client. This fork replaces that with a **native Streamable HTTP transport** (no `mcp-proxy`, no Python runtime), making the server reachable by remote AI agents over a Tailscale tailnet.

## Quick start

### 1. Create secret files on the host

Create two plain-text files containing only the credential value (no trailing newline):

```bash
mkdir -p /mnt/cache/appdata/docmost-mcp-bitcryptic/secrets

# Write email — no trailing newline:
printf '%s' 'your-bot-account@example.com' > /mnt/cache/appdata/docmost-mcp-bitcryptic/secrets/email

# Write password — no trailing newline:
printf '%s' 'your-bot-password' > /mnt/cache/appdata/docmost-mcp-bitcryptic/secrets/password

chmod 600 /mnt/cache/appdata/docmost-mcp-bitcryptic/secrets/*
```

### 2. File mount paths

Both paths are configurable via env vars with these defaults:

| Env var | Default path | Purpose |
|---|---|---|
| `DOCMOST_EMAIL_FILE` | `/run/secrets/docmost_email` | Bot account email |
| `DOCMOST_PASSWORD_FILE` | `/run/secrets/docmost_password` | Bot account password |

`DOCMOST_API_URL` is set as a plain env var (not a secret).

### 3. Per-instance deployment

Each bot identity gets its own container instance with:
- Separate secret files (different Docmost bot accounts for attribution and least-privilege)
- Separate Tailscale tag (different ACL boundary)
- Separate Tailscale state directory

| Instance | Bot account | Tailscale tag | ACL grants for |
|---|---|---|---|
| `docmost-mcp-bitcryptic` | bitcryptic bot | `tag:docmost-mcp-bitcryptic` | Claude, k3 |
| `docmost-mcp-slepner` | slepner bot | `tag:docmost-mcp-slepner` | Graham's agents |

### 4. Agent connection config

Once deployed, an agent's MCP client config points at the Tailscale hostname:

```json
{
  "mcpServers": {
    "docmost": {
      "url": "https://docmost-mcp-bitcryptic.pygmy-bramble.ts.net:8088/mcp"
    }
  }
}
```

The path `/mcp` serves the Streamable HTTP transport. Every path except `GET /health` is handed to the MCP transport, so the client URL is a convention rather than an enforced route — pick `/mcp` and point clients at it. There is no separate `/sse` endpoint in this fork.

No bearer token is needed at the HTTP layer — auth happens at the Docmost API layer via the bot account credentials loaded from file mounts. Network-layer access control is enforced by Tailscale ACLs.

## Building locally

```bash
docker build -t bitcryptic/docmost-mcp-wrapper .
```

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DOCMOST_API_URL` | Yes | — | Full URL to Docmost API (e.g. `https://docmost.pygmy-bramble.ts.net/api`) |
| `DOCMOST_EMAIL_FILE` | Yes | `/run/secrets/docmost_email` | Path to file containing bot email |
| `DOCMOST_PASSWORD_FILE` | Yes | `/run/secrets/docmost_password` | Path to file containing bot password |
| `MCP_PROXY_PORT` | No | `8088` | **Deprecated/ignored.** Use `PORT` — this variable is read by neither the entrypoint nor the server |
| `PORT` | No | `8088` | Port the Node server listens on inside the container. Invalid values abort startup |

## Security design

- Secrets are read from files at startup, exported into the shell environment, and the shell is replaced via `exec mcp-proxy ...`. The secrets exist in the running process's environment but are **never present in the container's declared environment** as visible by `docker inspect`.
- The entrypoint validates all inputs and refuses to start if secrets are missing, unreadable, or empty.
- No secret values are ever written to logs — even at debug level.
- The container runs as a non-root user (`mcpuser`, uid 1000) by default. If the Tailscale hook requires root for network configuration, add `--user root --cap-add=NET_ADMIN --cap-add=NET_RAW` to Extra Parameters.
- Network exposure is gated by Tailscale ACLs scoped to the specific port and tag — no LAN publishing, no Caddy reverse proxy.

## Updating upstream

To pull upstream changes:

```bash
git fetch upstream
git merge upstream/main
```

`src/`, `package.json`, `package-lock.json`, and `tsconfig.json` originate upstream. This fork **does** carry local patches to them — the Streamable HTTP transport, the file-based secret validation path, and the token-redaction fixes — so the rule is not "never touch these files", it is **keep patches small, isolated and called out in the commit body** so that upstream merges stay mechanical:

- Never reformat or restyle untouched upstream code.
- Put new logic in `src/lib/` as a new module instead of growing `src/index.ts`.
- Land new build/test tooling in new files (`tsconfig.test.json`, `test/`) rather than editing `tsconfig.json`.
- Say in the commit body that a change touches upstream-derived code.

The wrapper layer (`Dockerfile`, `docker-entrypoint.sh`, `docmost-mcp-wrapper.xml`, `WRAPPER.md`, `README.md`, `.github/`, `AGENTS.md`) is entirely ours and free to change.
