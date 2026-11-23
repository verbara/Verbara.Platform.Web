#!/bin/sh
# Run at image build time (see the Dockerfile): fails the build when the base
# image's nginx is older than the version given as $1. The /hubs/ upstream that
# 18-verbara-realtime-upstream.envsh writes uses `server ... resolve`, which
# nginx accepts only from 1.27.3 on; an older nginx refuses the configuration
# and the container does not start. `docker build` does not pull a base image
# it already has, so a builder holding an old nginx:alpine would otherwise ship
# an image that cannot start.
set -eu
min=${1:?usage: require-nginx-version.sh <minimum version>}
found=$(nginx -v 2>&1 | sed -n 's|^nginx version: nginx/\([0-9][0-9.]*\).*|\1|p')
if [ -z "$found" ]; then
  echo "require-nginx-version.sh: cannot read the nginx version from 'nginx -v': $(nginx -v 2>&1)" >&2
  exit 1
fi
# 0 when $found >= $min, comparing each dot-separated part as a number.
if ! awk -v a="$found" -v b="$min" 'BEGIN {
    na = split(a, x, "."); nb = split(b, y, ".")
    for (i = 1; i <= (na > nb ? na : nb); i++) {
      if (x[i] + 0 > y[i] + 0) exit 0
      if (x[i] + 0 < y[i] + 0) exit 1
    }
    exit 0
  }'; then
  echo "require-nginx-version.sh: the base image has nginx $found; this image needs nginx $min or later (the /hubs/ upstream uses 'server ... resolve'). Pull a newer base: docker pull nginx:alpine" >&2
  exit 1
fi
echo "require-nginx-version.sh: nginx $found (needs $min or later)"
