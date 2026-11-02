#!/usr/bin/env bash
# Netlify build: ดึงไฟล์เว็บ AssetSync ชุดล่าสุด (Release 'site' ของ repo AMS-COUNT) มาวางที่ /assetsync/
# ถ้าดึงไม่ได้ build จะล้ม → Netlify ไม่เปลี่ยนเว็บจริง (ยังใช้ชุดเดิม)
set -euo pipefail
URL="https://github.com/benzthopitak-pixel/AMS-COUNT/releases/download/site/assetsync-site.zip"
rm -rf assetsync /tmp/assetsync-site.zip
curl -fsSL --retry 3 -o /tmp/assetsync-site.zip "$URL"
mkdir assetsync
unzip -q /tmp/assetsync-site.zip -d assetsync
test -f assetsync/index.html
echo "AssetSync: $(cat assetsync/download/version.json 2>/dev/null || echo '?')"
