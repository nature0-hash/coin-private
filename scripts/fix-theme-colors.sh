#!/bin/bash
# Coin Private: replace hardcoded dark-theme hexes with semantic theme tokens
# so the whole UI adapts to light + dark mode.
set -euo pipefail
cd /home/z/my-project/src/components/cp

for f in $(ls admin/*.tsx client/*.tsx *.tsx 2>/dev/null); do
  sed -i \
    -e 's|text-\[#05c168\]|text-up|g' \
    -e 's|bg-\[#05c168\]|bg-up|g' \
    -e 's|border-\[#05c168\]|border-up|g' \
    -e 's|text-\[#ff5c66\]|text-destructive|g' \
    -e 's|border-\[#cf202f\]|border-destructive|g' \
    -e 's|bg-\[#cf202f\]|bg-destructive|g' \
    -e 's|text-\[#f5b13d\]|text-warn|g' \
    -e 's|bg-\[#f5b13d\]|bg-warn|g' \
    -e 's|border-\[#f5b13d\]|border-warn|g' \
    -e 's|fill-\[#f5b13d\]|fill-warn|g' \
    -e 's|hover:bg-\[#17191d\]|hover:bg-hover|g' \
    -e 's|bg-\[#0e1013\]/95|bg-sidebar/95|g' \
    -e 's|bg-\[#0e1013\]|bg-sidebar|g' \
    -e 's|hover:border-\[rgba(255,255,255,0.14)\]|hover:border-border-strong|g' \
    -e "s|background: '#16181c', border: '1px solid rgba(255,255,255,0.1)'|background: 'var(--popover)', border: '1px solid var(--border)'|g" \
    -e "s|rgba(255,255,255,0.2)|rgba(128,132,140,0.45)|g" \
    "$f"
done
echo "done"
