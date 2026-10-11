#!/bin/sh
# DEV ONLY. Self-signed CA + server certificate for the TLS listener (8883) of the bundled Mosquitto
# broker (docker-compose.yml service `mqtt`, docker/mosquitto/mosquitto.conf). The generated files under
# docker/mosquitto/certs/ are committed so `docker compose up` works without an extra step; the private
# keys are therefore public. Never reuse them outside the local Compose stack.
#
#   sh docker/mosquitto/gen-dev-certs.sh [out-dir]       # needs openssl 1.1.1+ (Git Bash on Windows has one)
#   docker run --rm -v "$PWD/docker/mosquitto:/w" -w /w alpine:3.20 \
#       sh -c 'apk add -q openssl && sh gen-dev-certs.sh'  # when the host has no openssl
#
# Output: dev-ca.crt / dev-ca.key (trust anchor; clients use dev-ca.crt as their CA), dev-server.crt /
# dev-server.key (listener 8883). SAN lists the names a client may connect with: localhost, mqtt (from
# other containers), proact-mqtt-1, host.docker.internal, 127.0.0.1, ::1. Valid 10 years.
set -eu
# Git Bash would otherwise rewrite "/CN=..." into a Windows path
export MSYS_NO_PATHCONV=1

OUT=${1:-$(dirname "$0")/certs}
DAYS=3650
SAN="DNS:localhost,DNS:mqtt,DNS:proact-mqtt-1,DNS:host.docker.internal,IP:127.0.0.1,IP:::1"

command -v openssl >/dev/null 2>&1 || {
  echo "openssl not found; run this script inside a container (see the header)" >&2
  exit 1
}
mkdir -p "$OUT"
EXT="$OUT/dev-server.ext"
trap 'rm -f "$EXT" "$OUT/dev-server.csr" "$OUT/dev-ca.srl"' EXIT

openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days "$DAYS" \
  -subj "/CN=Pro-Act dev MQTT CA (not for production)" \
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" \
  -keyout "$OUT/dev-ca.key" -out "$OUT/dev-ca.crt"

openssl req -new -newkey rsa:2048 -sha256 -nodes -subj "/CN=localhost" \
  -keyout "$OUT/dev-server.key" -out "$OUT/dev-server.csr"

printf 'basicConstraints=CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=%s\n' "$SAN" > "$EXT"
openssl x509 -req -sha256 -days "$DAYS" -in "$OUT/dev-server.csr" \
  -CA "$OUT/dev-ca.crt" -CAkey "$OUT/dev-ca.key" -CAcreateserial -extfile "$EXT" \
  -out "$OUT/dev-server.crt"

openssl verify -CAfile "$OUT/dev-ca.crt" "$OUT/dev-server.crt"
openssl x509 -in "$OUT/dev-server.crt" -noout -subject -ext subjectAltName -enddate
