#!/bin/sh
set -e

log() { printf '%s\n' "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

if [ -z "${DOCMOST_API_URL}" ]; then
    die "DOCMOST_API_URL is not set. Refusing to start."
fi

EMAIL_FILE="${DOCMOST_EMAIL_FILE:-/run/secrets/docmost_email}"
PASSWORD_FILE="${DOCMOST_PASSWORD_FILE:-/run/secrets/docmost_password}"

DOCMOST_EMAIL=""
if [ -f "${EMAIL_FILE}" ] && [ -r "${EMAIL_FILE}" ]; then
    DOCMOST_EMAIL="$(cat "${EMAIL_FILE}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
elif [ -n "${DOCMOST_EMAIL:-}" ]; then
    DOCMOST_EMAIL="${DOCMOST_EMAIL}"
    log "Using DOCMOST_EMAIL from environment"
else
    die "DOCMOST_EMAIL not available (file ${EMAIL_FILE} missing and env var empty)"
fi

# A readable but empty (or whitespace-only) file resolves to an empty value.
# Refuse here rather than starting a server that can only fail at first login.
if [ -z "${DOCMOST_EMAIL}" ]; then
    die "DOCMOST_EMAIL resolved to an empty value (file ${EMAIL_FILE} is empty or whitespace-only)"
fi

DOCMOST_PASSWORD=""
if [ -f "${PASSWORD_FILE}" ] && [ -r "${PASSWORD_FILE}" ]; then
    DOCMOST_PASSWORD="$(cat "${PASSWORD_FILE}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
elif [ -n "${DOCMOST_PASSWORD:-}" ]; then
    DOCMOST_PASSWORD="${DOCMOST_PASSWORD}"
    log "Using DOCMOST_PASSWORD from environment"
else
    die "DOCMOST_PASSWORD not available (file ${PASSWORD_FILE} missing and env var empty)"
fi

if [ -z "${DOCMOST_PASSWORD}" ]; then
    die "DOCMOST_PASSWORD resolved to an empty value (file ${PASSWORD_FILE} is empty or whitespace-only)"
fi

export DOCMOST_EMAIL DOCMOST_PASSWORD

PORT="${PORT:-8088}"

log "Starting docmost MCP server on 0.0.0.0:${PORT}..."
log "DOCMOST_API_URL is configured."

exec node ./build/index.js
