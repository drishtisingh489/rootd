#!/usr/bin/env bash
# Run root'd for testing on a phone:
#   - backend (FastAPI) on 0.0.0.0:8000
#   - frontend (Vite) on all interfaces, port 5173 (it proxies /api to the backend)
#   - an HTTPS Cloudflare quick tunnel to the frontend (the live camera needs HTTPS on phones)
# Prints the LAN and HTTPS URLs with QR codes. Press Ctrl+C to stop everything.
#
# Usage: ./scripts/phone.sh            (from the repo root)
#        NO_TUNNEL=1 ./scripts/phone.sh   (LAN only)
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$(mktemp -d -t rootd-phone)"
PIDS=()

cleanup() {
  echo
  echo "Stopping root'd…"
  for pid in "${PIDS[@]:-}"; do [ -n "$pid" ] && kill "$pid" 2>/dev/null; done
  wait 2>/dev/null
  echo "Stopped. Logs were in $LOG_DIR"
}
trap cleanup EXIT INT TERM

for port in 8000 5173; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is already in use. Stop whatever is running there first:"
    echo "  lsof -ti tcp:$port | xargs kill"
    exit 1
  fi
done

IFACE="$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')"
LAN_IP="$(ipconfig getifaddr "${IFACE:-en0}" 2>/dev/null || ipconfig getifaddr en0 2>/dev/null || true)"
if [ -z "$LAN_IP" ]; then
  echo "Couldn't find this computer's LAN IP (is Wi-Fi connected?). Continuing with the tunnel only."
fi

TUNNEL_URL=""
if [ -z "${NO_TUNNEL:-}" ]; then
  if command -v cloudflared >/dev/null 2>&1; then
    cloudflared tunnel --no-autoupdate --url http://localhost:5173 >"$LOG_DIR/tunnel.log" 2>&1 &
    PIDS+=($!)
    for _ in $(seq 1 60); do
      TUNNEL_URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_DIR/tunnel.log" | head -1)"
      [ -n "$TUNNEL_URL" ] && break
      sleep 0.5
    done
    [ -z "$TUNNEL_URL" ] && echo "The HTTPS tunnel didn't start (see $LOG_DIR/tunnel.log). Continuing on the LAN only."
  else
    echo "cloudflared isn't installed (brew install cloudflared). Continuing on the LAN only."
  fi
fi

# CORS isn't needed while the browser goes through Vite's /api proxy, but allow these origins in case
# VITE_API_BASE_URL points the browser straight at the backend. Env vars override the .env file.
CORS="http://localhost:5173"
[ -n "$LAN_IP" ] && CORS="$CORS,http://$LAN_IP:5173"
[ -n "$TUNNEL_URL" ] && CORS="$CORS,$TUNNEL_URL"

(cd "$ROOT/backend" && CORS_ORIGINS="$CORS" exec .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000) \
  >"$LOG_DIR/backend.log" 2>&1 &
PIDS+=($!)
(cd "$ROOT/frontend" && exec npx vite --host --port 5173 --strictPort) >"$LOG_DIR/frontend.log" 2>&1 &
PIDS+=($!)

up() { curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$1"; }
for _ in $(seq 1 60); do
  [ "$(up http://127.0.0.1:8000/api/health)" = 200 ] && [ "$(up http://127.0.0.1:5173/)" = 200 ] && break
  sleep 0.5
done
if [ "$(up http://127.0.0.1:8000/api/health)" != 200 ]; then echo "Backend failed to start:"; tail -20 "$LOG_DIR/backend.log"; exit 1; fi
if [ "$(up http://127.0.0.1:5173/)" != 200 ]; then echo "Frontend failed to start:"; tail -20 "$LOG_DIR/frontend.log"; exit 1; fi

qr() { (cd "$LOG_DIR" && npx --yes qrcode@1.5.4 --small "$1" 2>/dev/null) || echo "(couldn't draw a QR code; type the URL instead)"; }

echo
echo "root'd is running. Logs: $LOG_DIR"
OPENROUTER_STATE="$(curl -s http://127.0.0.1:8000/api/health | grep -q '"openrouter_configured":true' && echo on || echo 'OFF (demo mode: barcode/name lookup + demo products)')"
echo "Photo identification: $OPENROUTER_STATE"
if [ -n "$LAN_IP" ]; then
  echo
  echo "Same Wi-Fi (http, photo upload/take-photo works; live camera preview needs HTTPS):"
  echo "  http://$LAN_IP:5173   (API via proxy: HTTP $(up "http://$LAN_IP:5173/api/health"))"
  qr "http://$LAN_IP:5173"
fi
if [ -n "$TUNNEL_URL" ]; then
  echo
  echo "HTTPS from anywhere (live camera works). Anyone with this link can open the app:"
  for _ in $(seq 1 20); do [ "$(up "$TUNNEL_URL/api/health")" = 200 ] && break; sleep 1; done
  echo "  $TUNNEL_URL   (API via tunnel: HTTP $(up "$TUNNEL_URL/api/health"))"
  qr "$TUNNEL_URL"
fi
echo
echo "Press Ctrl+C to stop everything."
wait
