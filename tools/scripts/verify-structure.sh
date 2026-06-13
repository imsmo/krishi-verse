#!/usr/bin/env bash
# tools/scripts/verify-structure.sh · CI-runnable structure integrity gate · [P1]
# Fails if: empty dirs exist, an app lacks connective files, filenames are
# malformed, or a tenant_id-style law file is missing. Run in CI on every PR.
set -e; cd "$(dirname "$0")/../.."
FAIL=0
echo "[1] empty directories:"; E=$(find . -type d -empty -not -path "./.git/*"); [ -n "$E" ] && { echo "$E"; FAIL=1; } || echo "  none"
echo "[2] malformed filenames:"; B=$(find . -name "* (*" -o -name "* *.ts" -type f | grep -v " " || true); M=$(find . -type f -name "* (*"); [ -n "$M" ] && { echo "$M"; FAIL=1; } || echo "  none"
echo "[3] app connective files:"
for a in apps/*/; do n=$(basename $a)
  [ -f "$a/package.json" ] || [ -f "$a/pyproject.toml" ] || { echo "  $n: missing pkg manifest"; FAIL=1; }
  case $n in mobile) [ -f "$a/eas.json" ] || { echo "  $n: missing eas.json"; FAIL=1; };;
    *) [ -f "$a/Dockerfile" ] || { echo "  $n: missing Dockerfile"; FAIL=1; };; esac
  ls $a/.env.example >/dev/null 2>&1 || { case $n in web-storefront|mobile) :;; *) echo "  $n: missing .env.example"; FAIL=1;; esac; }
done
echo "[4] law files present:"
for f in CLAUDE.md CODEOWNERS FILE_MANIFEST.md docs/architecture/role-surface-matrix.md db/migrations/0001_foundation.sql; do
  [ -f "$f" ] || { echo "  missing $f"; FAIL=1; }
done
[ $FAIL -eq 0 ] && echo "STRUCTURE OK" || { echo "STRUCTURE BROKEN"; exit 1; }
