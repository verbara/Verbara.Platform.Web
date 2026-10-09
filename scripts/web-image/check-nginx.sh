#!/usr/bin/env bash
# Container check for the web image's nginx (H21, H14, N20 of the OpenSpec change
# the-console-account-and-session-surfaces-match-the-api).
#
# Usage: scripts/web-image/check-nginx.sh <image> [suffix]
#   GATEWAY_CONF=<path to Platform's docker/nginx-gateway.conf>  also checks the
#   compose gateway path in front of the image (optional).
#
# Runs the image on a throwaway Docker network next to a stub upstream (an
# nginx:alpine container aliased platform-api and realtime, see
# stub-upstream.conf), then checks, printing the evidence for each:
#   config   nginx -t passes in the image.
#   H21      a generated value in /reset-password?token= (and in the Referer's
#            query) and in /api/v1/events/stream?token= (upstream failing) never
#            reaches `docker logs`; the access log shows both paths and statuses.
#   H14      GET /api/v1/admin/users/<id> keeps the upstream's strong ETag and is
#            not compressed, with and without Accept-Encoding: gzip; a static
#            asset is still gzip-compressed.
#   N20      SignalR's negotiate POST /hubs/platform/negotiate reaches the
#            realtime upstream instead of a 405 from the static files, also with
#            the Kubernetes-shaped default upstream (KUBERNETES_SERVICE_HOST set,
#            namespace search domain, read-only root filesystem, uid 101).
# Every value is generated per run; never a real token. Everything the script
# creates carries the suffix and is removed on exit. Exit 0 only if every check
# passes.
set -euo pipefail

IMAGE=${1:?usage: check-nginx.sh <image> [suffix]}
SUFFIX=${2:-chk$RANDOM}
HERE=$(cd "$(dirname "$0")" && pwd)
STUB_IMAGE=${STUB_IMAGE:-nginx:alpine}
NET=vweb-net-$SUFFIX
STUB=vweb-stub-$SUFFIX
WEB=vweb-web-$SUFFIX
WEBK8S=vweb-webk8s-$SUFFIX
GW=vweb-gw-$SUFFIX
K8S_SEARCH=vweb-ns.svc.cluster.local
FAIL=0

cleanup() {
  docker rm -f "$STUB" "$WEB" "$WEBK8S" "$GW" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

check() { # check <name> <ok:0|1> <detail>
  if [ "$2" = 0 ]; then echo "PASS $1 — $3"; else echo "FAIL $1 — $3"; FAIL=1; fi
}

rand() { od -An -N12 -tx1 /dev/urandom | tr -d ' \n'; }

port_of() { docker port "$1" 80/tcp 2>/dev/null | head -1 | sed 's/.*://'; }

wait_http() { # wait_http <container> <port>
  for _ in $(seq 1 50); do
    [ -n "$2" ] && curl -s -o /dev/null "http://127.0.0.1:$2/" && return 0
    sleep 0.2
  done
  echo "FAIL $1 never answered on port [$2]; its last log lines:"
  docker logs "$1" 2>&1 | tail -5
  FAIL=1
}

header() { # header <name> <curl -D dump>
  { grep -i "^$1:" <<<"$2" || true; } | head -1 | cut -d: -f2- | tr -d '\r' | sed 's/^ //'
}

echo "image:      $IMAGE ($(docker image inspect "$IMAGE" --format '{{.Id}}'))"
echo "stub image: $STUB_IMAGE ($(docker image inspect "$STUB_IMAGE" --format '{{index .RepoDigests 0}}' 2>/dev/null || echo 'not pulled'))"
echo "nginx:      $(docker run --rm --entrypoint nginx "$IMAGE" -v 2>&1)"

docker network create "$NET" >/dev/null
docker run -d --name "$STUB" --network "$NET" \
  --network-alias platform-api --network-alias realtime \
  --network-alias "platform-realtime.$K8S_SEARCH" \
  -v "$HERE/stub-upstream.conf:/etc/nginx/conf.d/default.conf:ro" "$STUB_IMAGE" >/dev/null

# --- config -----------------------------------------------------------------
cfg_out=$(docker run --rm --network "$NET" "$IMAGE" nginx -t 2>&1) && cfg_rc=0 || cfg_rc=$?
check "config: nginx -t" "$cfg_rc" "$(grep -E 'test is|emerg' <<<"$cfg_out" | tr '\n' ' ')"

docker run -d --name "$WEB" --network "$NET" --network-alias web -p 127.0.0.1::80 "$IMAGE" >/dev/null
P=$(port_of "$WEB")
wait_http "$WEB" "$P"

# --- H21 --------------------------------------------------------------------
RESET=$(rand)
SSE=$(rand)
reset_status=$(curl -s -o /dev/null -w '%{http_code}' \
  -H "Referer: http://console.example.test/forgot-password?token=$RESET&step=2" \
  "http://127.0.0.1:$P/reset-password?token=$RESET")
sse_status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  "http://127.0.0.1:$P/api/v1/events/stream?token=$SSE")
HUB=$(rand)
hub_status=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$P/hubs/platform?id=x&access_token=$HUB")
sleep 0.5
logs=$(docker logs "$WEB" 2>&1)
hub_count=$(grep -c "$HUB" <<<"$logs" || true)
reset_count=$(grep -c "$RESET" <<<"$logs" || true)
sse_count=$(grep -c "$SSE" <<<"$logs" || true)
echo "H21 requests: /reset-password -> $reset_status, /api/v1/events/stream -> $sse_status"
echo "H21 GET /hubs/platform?access_token= -> $hub_status"
echo "H21 log lines carrying the reset value: $reset_count; the SSE value: $sse_count; the hub value: $hub_count"
echo "--- docker logs (generated values replaced by <reset>/<sse>/<hub>, start-up lines dropped)"
sed -e "s/$RESET/<reset>/g" -e "s/$SSE/<sse>/g" -e "s/$HUB/<hub>/g" <<<"$logs" | grep -v 'docker-entrypoint\|^10-listen\|^20-envsubst\|^30-tune\|start worker\|using the\|built by\|OS: \|getrlimit\|nginx/1\.' || true
echo "---"
check "H21: reset value absent from logs" "$([ "$reset_count" = 0 ] && echo 0 || echo 1)" "$reset_count lines"
check "H21: SSE value absent from logs" "$([ "$sse_count" = 0 ] && echo 0 || echo 1)" "$sse_count lines"
check "H21: hub access_token absent from logs" "$([ "$hub_count" = 0 ] && echo 0 || echo 1)" "$hub_count lines"
access_reset=$(grep -c "\"GET /reset-password HTTP/1.1\" $reset_status " <<<"$logs" || true)
access_sse=$(grep -c "\"GET /api/v1/events/stream HTTP/1.1\" $sse_status " <<<"$logs" || true)
check "H21: access log shows /reset-password and its status" "$([ "$access_reset" -ge 1 ] && echo 0 || echo 1)" "$access_reset lines"
check "H21: access log shows /api/v1/events/stream and its status" "$([ "$access_sse" -ge 1 ] && echo 0 || echo 1)" "$access_sse lines"
referer_path=$(grep -c '"http://console.example.test/forgot-password"' <<<"$logs" || true)
check "H21: Referer logged as scheme, host and path" "$([ "$referer_path" -ge 1 ] && echo 0 || echo 1)" "$referer_path lines"

# --- H14 --------------------------------------------------------------------
USER_URL="http://127.0.0.1:$P/api/v1/admin/users/stub-user-g8"
plain=$(curl -s -o /dev/null -D - "$USER_URL")
gz=$(curl -s -o /dev/null -D - -H 'Accept-Encoding: gzip' "$USER_URL")
echo "H14 without Accept-Encoding: ETag=[$(header etag "$plain")] Content-Encoding=[$(header content-encoding "$plain")]"
echo "H14 with Accept-Encoding: gzip: ETag=[$(header etag "$gz")] Content-Encoding=[$(header content-encoding "$gz")]"
check "H14: strong ETag without gzip" "$([ "$(header etag "$plain")" = '"stub-strong-etag-7f3a9c"' ] && echo 0 || echo 1)" "$(header etag "$plain")"
check "H14: strong ETag with Accept-Encoding: gzip" "$([ "$(header etag "$gz")" = '"stub-strong-etag-7f3a9c"' ] && echo 0 || echo 1)" "$(header etag "$gz")"
check "H14: API response not compressed" "$([ -z "$(header content-encoding "$gz")" ] && echo 0 || echo 1)" "[$(header content-encoding "$gz")]"
ASSET=$(docker exec "$WEB" sh -c 'ls /usr/share/nginx/html/assets/*.js | head -1' | sed 's#/usr/share/nginx/html##')
static=$(curl -s -o /dev/null -D - -H 'Accept-Encoding: gzip' "http://127.0.0.1:$P$ASSET")
echo "H14 static $ASSET with gzip: Content-Type=[$(header content-type "$static")] Content-Encoding=[$(header content-encoding "$static")]"
check "H14: static asset still gzip-compressed" "$([ "$(header content-encoding "$static")" = gzip ] && echo 0 || echo 1)" "[$(header content-encoding "$static")]"

# --- N20 --------------------------------------------------------------------
negotiate() { # negotiate <port>
  curl -s -o /dev/null -D - -X POST -H 'Content-Type: text/plain;charset=UTF-8' \
    -H "Authorization: Bearer $(rand)" \
    "http://127.0.0.1:$1/hubs/platform/negotiate?negotiateVersion=1"
}
neg=$(negotiate "$P")
echo "N20 POST /hubs/platform/negotiate: $(head -1 <<<"$neg" | tr -d '\r') X-Stub-Upstream=[$(header x-stub-upstream "$neg")]"
check "N20: negotiate reaches the realtime upstream" "$([ "$(header x-stub-upstream "$neg")" = realtime ] && echo 0 || echo 1)" "$(head -1 <<<"$neg" | tr -d '\r')"

# Shaped like the Helm chart's web pod: the namespace search domain, a read-only
# root filesystem with emptyDirs at /var/cache/nginx and /var/run, uid 101 and
# no capabilities.
docker run -d --name "$WEBK8S" --network "$NET" --dns-search "$K8S_SEARCH" \
  -e KUBERNETES_SERVICE_HOST=10.96.0.1 --read-only \
  --tmpfs /var/cache/nginx:uid=101,gid=101 --tmpfs /var/run:uid=101,gid=101 \
  --user 101:101 --cap-drop ALL --security-opt no-new-privileges \
  -p 127.0.0.1::80 "$IMAGE" >/dev/null
PK=$(port_of "$WEBK8S")
wait_http "$WEBK8S" "$PK"
negk=$(negotiate "$PK")
echo "N20 (Kubernetes-shaped) POST /hubs/platform/negotiate: $(head -1 <<<"$negk" | tr -d '\r') X-Stub-Upstream=[$(header x-stub-upstream "$negk")]"
# The stub also answers as `realtime`; check the rendered upstream really is the Kubernetes name.
k8s_upstream=$(docker exec "$WEBK8S" sh -c 'grep -o "set \$verbara_realtime [^;]*" /var/run/verbara-realtime-upstream.conf' 2>/dev/null || true)
echo "N20 (Kubernetes-shaped) rendered: $k8s_upstream"
check "N20: Kubernetes default upstream is platform-realtime.<namespace search domain>" "$([ "$k8s_upstream" = "set \$verbara_realtime platform-realtime.$K8S_SEARCH:5030" ] && echo 0 || echo 1)" "$k8s_upstream"
check "N20: negotiate reaches realtime with the Kubernetes default" "$([ "$(header x-stub-upstream "$negk")" = realtime ] && echo 0 || echo 1)" "$(head -1 <<<"$negk" | tr -d '\r')"

# --- gateway path (optional) ------------------------------------------------
if [ -n "${GATEWAY_CONF:-}" ]; then
  docker run -d --name "$GW" --network "$NET" -p 127.0.0.1::80 \
    -v "$GATEWAY_CONF:/etc/nginx/conf.d/default.conf:ro" "$STUB_IMAGE" >/dev/null
  PG=$(port_of "$GW")
  wait_http "$GW" "$PG"
  negg=$(negotiate "$PG")
  idx=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PG/reset-password?token=$(rand)")
  echo "gateway POST /hubs/platform/negotiate: $(head -1 <<<"$negg" | tr -d '\r') X-Stub-Upstream=[$(header x-stub-upstream "$negg")]; GET /reset-password -> $idx"
  check "gateway: /hubs/ still goes straight to realtime" "$([ "$(header x-stub-upstream "$negg")" = realtime ] && echo 0 || echo 1)" "$(head -1 <<<"$negg" | tr -d '\r')"
  check "gateway: console route still served through the web image" "$([ "$idx" = 200 ] && echo 0 || echo 1)" "$idx"
fi

exit "$FAIL"
