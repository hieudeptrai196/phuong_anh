#!/usr/bin/env bash
# Renders the downloadable page images, the voucher image and the gift QR code.
#
#   tools/render-assets.sh [PUBLIC_URL]
#
# PUBLIC_URL is where the site is published (e.g. https://phuonganh22.netlify.app).
# The QR code points to PUBLIC_URL/voucher.html, so re-run this after deploying.
# Needs the local preview server on http://localhost:5190 and: Google Chrome, ImageMagick, qrencode.
set -euo pipefail

cd "$(dirname "$0")/.."
LOCAL="http://localhost:5190"
PUBLIC_URL="${1:-$LOCAL}"
PUBLIC_URL="${PUBLIC_URL%/}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p assets/shots

shoot() { # url width height out.png
  "$CHROME" --headless=new --hide-scrollbars --disable-gpu --force-device-scale-factor=2 \
    --window-size="$2,$3" --virtual-time-budget=9000 --screenshot="$4" "$1" >/dev/null 2>&1
}

for page in cover portrait travel grad work; do
  shoot "$LOCAL/index.html?shot=$page" 1600 1000 "$TMP/$page-desktop.png"
  shoot "$LOCAL/index.html?shot=$page" 540 960 "$TMP/$page-mobile.png"
  for format in desktop mobile; do
    magick "$TMP/$page-$format.png" -strip -quality 86 -interlace Plane "assets/shots/$page-$format.jpg"
  done
  echo "page  $page"
done

shoot "$LOCAL/voucher.html?render" 540 675 "$TMP/voucher.png"
magick "$TMP/voucher.png" -strip assets/voucher.png
magick -size 1200x630 xc:'#28251F' \( assets/voucher.png -resize x600 \) -gravity center -composite \
  -strip -quality 86 assets/og-voucher.jpg
echo "voucher  assets/voucher.png, assets/og-voucher.jpg"

# Link previews need absolute URLs, so point og:url / og:image at the public site.
if [[ "$PUBLIC_URL" != "$LOCAL" ]]; then
  sed -i '' -E \
    -e "s#<meta property=\"og:url\" content=\"[^\"]*\">#<meta property=\"og:url\" content=\"$PUBLIC_URL/\">#" \
    -e "s#<meta property=\"og:image\" content=\"[^\"]*\">#<meta property=\"og:image\" content=\"$PUBLIC_URL/assets/og-cover.jpg\">#" index.html
  sed -i '' -E \
    -e "s#<meta property=\"og:url\" content=\"[^\"]*\">#<meta property=\"og:url\" content=\"$PUBLIC_URL/voucher.html\">#" \
    -e "s#<meta property=\"og:image\" content=\"[^\"]*\">#<meta property=\"og:image\" content=\"$PUBLIC_URL/assets/og-voucher.jpg\">#" voucher.html
  echo "og  link previews -> $PUBLIC_URL"
fi

qrencode -s 14 -m 2 -l M --foreground=28251F --background=FBF9F6 -o assets/qr.png "$PUBLIC_URL/voucher.html"
echo "qr  assets/qr.png -> $PUBLIC_URL/voucher.html"
