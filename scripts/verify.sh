#!/usr/bin/env sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
exec "${BILICDN_NODE:-node}" scripts/verify.mts
