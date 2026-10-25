#!/usr/bin/env bash
# Runs all tests with the Go race detector inside a Linux Go container.
# Needs Docker only: no local 64-bit C compiler required. MySQL is reached on
# the host through host.docker.internal (override with MK_TEST_MYSQL_DSN).
set -euo pipefail
cd "$(dirname "$0")/.."
DSN="${MK_TEST_MYSQL_DSN:-root:root@tcp(host.docker.internal:3306)/}"
SRC="$(pwd -W 2>/dev/null || pwd)"   # Windows path under Git Bash, plain path elsewhere
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "$SRC:/src" -v mk-gomod:/go/pkg/mod -w /src \
  -e MK_TEST_MYSQL_DSN="$DSN" -e GOFLAGS=-buildvcs=false \
  golang:1.26 go test -race -count=1 "$@" ./...
