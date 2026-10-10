#!/bin/sh
# Сжатые превью для сайта: assets/site/thumbs/<путь, где / заменён на __>.webp
# Запуск из корня сайта: sh tools/make-thumbs.sh  (нужен cwebp: brew install webp)
# Если превью нет, сайт сам подставит исходный PNG.
set -e
cd "$(dirname "$0")/.."
out=assets/site/thumbs
mkdir -p "$out"
grep -ohE '\./(docs|art)/[^"]+\.png' data.js index.html | sort -u | while read -r src; do
  path=${src#./}
  name=$(printf '%s' "$path" | sed 's#/#__#g; s#\.png$#.webp#')
  if [ -f "$out/$name" ] && [ "$out/$name" -nt "$path" ]; then continue; fi
  w=$(sips -g pixelWidth "$path" | awk '/pixelWidth/{print $2}')
  if [ "$w" -gt 1280 ]; then
    cwebp -quiet -q 74 -resize 1280 0 "$path" -o "$out/$name"
  else
    cwebp -quiet -q 74 "$path" -o "$out/$name"
  fi
  echo "$out/$name"
done
cwebp -quiet -q 80 docs/city/street.png -o assets/site/hero-street.webp
sips -s format jpeg -s formatOptions 82 -Z 1200 docs/city/street.png --out assets/site/og.jpg >/dev/null
