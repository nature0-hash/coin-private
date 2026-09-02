#!/bin/bash
# ============================================================
# Coin Private: deliverable packager
# Creates /home/z/my-project/download/coin-private.zip containing
# the complete project, excluding local/infra-only artifacts.
# ============================================================
set -euo pipefail
SRC=/home/z/my-project
OUT=/home/z/my-project/download/coin-private.zip

cd "$SRC"
rm -f "$OUT"
mkdir -p "$(dirname "$OUT")"

zip -r -q "$OUT" . \
  -x "node_modules/*" \
  -x ".next/*" \
  -x ".git/*" \
  -x ".zscripts/*" \
  -x ".claude/*" \
  -x ".z-ai-config/*" \
  -x "download/*" \
  -x "upload/*" \
  -x "skills/*" \
  -x "mini-services/*" \
  -x "tests/*" \
  -x "examples/*" \
  -x "agent-ctx/*" \
  -x "worklog.md" \
  -x "dev.log" \
  -x "server.log" \
  -x "dev.out.log" \
  -x "tsconfig.tsbuildinfo" \
  -x "Caddyfile" \
  -x "scripts/check-*.png" \
  -x "scripts/make_favicon.py" \
  -x "scripts/update-provider.ts" \
  -x "scripts/package-zip.sh" \
  -x "scripts/preview-keepalive.sh" \
  -x "db/*.db-journal" \
  -x "db/*.db-wal" \
  -x "db/*.db-shm"

echo "=== ZIP created ==="
ls -lh "$OUT"
echo "=== file count ==="
unzip -l "$OUT" | tail -1
echo "=== safety: no forbidden strings inside ==="
if unzip -p "$OUT" "$(unzip -l "$OUT" | rg -o 'scripts/[a-z-]+\.ts' | head -1)" 2>/dev/null | rg -qi 'z-ai-web-dev-sdk'; then echo "WARN: stale"; fi
rm -f /tmp/ziplist.txt
unzip -l "$OUT" | awk '{print $4}' > /tmp/ziplist.txt
rg -i 'z-ai|\.claude|zscripts|caddyfile|worklog' /tmp/ziplist.txt && echo "!!! FORBIDDEN FILES IN ZIP" || echo "clean: no z-ai/claude/zscripts/caddyfile/worklog in ZIP"
rg '^\.env$' /tmp/ziplist.txt && echo ".env included (zero-config local run)" || echo "WARN: .env missing"
rg '^\.env\.example$' /tmp/ziplist.txt && echo ".env.example included" || echo "WARN: .env.example missing"
rg '^bun\.lock$' /tmp/ziplist.txt && echo "bun.lock included" || echo "WARN: bun.lock missing"
rg '^db/custom\.db$' /tmp/ziplist.txt && echo "db/custom.db included (pristine seed)" || echo "WARN: db missing"
rg '^src/app/icon\.png$' /tmp/ziplist.txt && echo "favicon included" || echo "WARN: favicon missing"
rg '^public/logo\.svg$' /tmp/ziplist.txt && echo "logo.svg included" || echo "WARN: logo.svg missing"
