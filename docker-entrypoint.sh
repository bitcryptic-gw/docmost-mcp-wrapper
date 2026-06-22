#!/bin/sh
set -e

log() { printf '%s\n' "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

# --- Validate DOCMOST_API_URL ---
if [ -z "${DOCMOST_API_URL}" ]; then
    die "DOCMOST_API_URL is not set. Refusing to start."
fi

# --- File paths (configurable, with defaults) ---
EMAIL_FILE="${DOCMOST_EMAIL_FILE:-/run/secrets/docmost_email}"
PASSWORD_FILE="${DOCMOST_PASSWORD_FILE:-/run/secrets/docmost_password}"

# --- Validate secret files exist and are readable ---
if [ ! -f "${EMAIL_FILE}" ]; then
    die "DOCMOST_EMAIL_FILE not found at ${EMAIL_FILE}. Refusing to start."
fi
if [ ! -r "${EMAIL_FILE}" ]; then
    die "DOCMOST_EMAIL_FILE at ${EMAIL_FILE} is not readable. Refusing to start."
fi
if [ ! -f "${PASSWORD_FILE}" ]; then
    die "DOCMOST_PASSWORD_FILE not found at ${PASSWORD_FILE}. Refusing to start."
fi
if [ ! -r "${PASSWORD_FILE}" ]; then
    die "DOCMOST_PASSWORD_FILE at ${PASSWORD_FILE} is not readable. Refusing to start."
fi

# --- Read and trim secrets (strips leading/trailing whitespace and newlines) ---
DOCMOST_EMAIL="$(cat "${EMAIL_FILE}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
DOCMOST_PASSWORD="$(cat "${PASSWORD_FILE}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

# --- Validate secrets are non-empty after trimming ---
if [ -z "${DOCMOST_EMAIL}" ]; then
    die "DOCMOST_EMAIL file at ${EMAIL_FILE} is empty after trimming. Refusing to start."
fi
if [ -z "${DOCMOST_PASSWORD}" ]; then
    die "DOCMOST_PASSWORD file at ${PASSWORD_FILE} is empty after trimming. Refusing to start."
fi

# --- Export for downstream processes ---
export DOCMOST_EMAIL
export DOCMOST_PASSWORD

# --- Determine listen port ---
PORT="${MCP_PROXY_PORT:-8088}"

log "Starting mcp-proxy on 0.0.0.0:${PORT}..."
log "DOCMOST_API_URL is configured."
log "Secrets loaded from files."

# exec into mcp-proxy, which becomes PID 1.
# --pass-environment ensures exported env vars flow through to the node child.
# The node process inherits DOCMOST_EMAIL / DOCMOST_PASSWORD / DOCMOST_API_URL
# from the same environment without them ever appearing in docker inspect.
exec mcp-proxy \
    --host=0.0.0.0 \
    --port="${PORT}" \
    --pass-environment \
    -- \
    node ./build/index.js
