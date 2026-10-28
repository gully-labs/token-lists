#!/usr/bin/env python3
"""Makes the missing token logos listed in logos/todo.json (written by build.mjs).

For each token without logos/<chainId>/<address>.svg|png:
  - the launch image (metadataURI "image", https:// or ipfs://) is downloaded and saved as a 256x256 PNG, or
  - an original mark is generated: a dark disc, a two-colour ring and the symbol's first letters, with the two colours
    derived from the address so every token's mark is different.
Logo spec (CONTRIBUTING.md): square PNG 256x256 (or SVG), under 100 KB, no third-party trademarks.

    python logos.py            # needs Pillow (pip install Pillow==12.3.0)
"""
import hashlib, io, json, os, sys, urllib.request, colorsys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LOGOS = os.path.join(ROOT, 'logos')
SIZE = 256
BG = (10, 16, 24)  # Gully Chain kit ink #0A1018
FONTS = [
    os.environ.get('LOGO_FONT', ''),
    'C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/arialbd.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
]


def font(px):
    for f in FONTS:
        if f and os.path.exists(f):
            return ImageFont.truetype(f, px)
    sys.exit('no bold TTF font found: set LOGO_FONT=/path/to/font.ttf')


def colours(address):
    h = hashlib.sha256(address.lower().encode()).digest()
    hue = h[0] / 255
    hue2 = (hue + 0.18 + (h[1] / 255) * 0.25) % 1
    c1 = tuple(int(x * 255) for x in colorsys.hls_to_rgb(hue, 0.56, 0.95))
    c2 = tuple(int(x * 255) for x in colorsys.hls_to_rgb(hue2, 0.52, 0.95))
    return c1, c2


def mark(address, symbol):
    """Original mark: disc, diagonal gradient ring, 1-3 letter monogram in the gradient. Rendered at 4x, downsampled."""
    s = SIZE * 4
    c1, c2 = colours(address)
    grad = Image.new('RGB', (s, s))
    gp = grad.load()
    for y in range(s):
        for x in range(s):
            t = (x + y) / (2 * s - 2)
            gp[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    disc = Image.new('L', (s, s), 0)
    ImageDraw.Draw(disc).ellipse((0, 0, s - 1, s - 1), fill=255)
    img.paste(Image.new('RGB', (s, s), BG), (0, 0), disc)
    ring = Image.new('L', (s, s), 0)
    d = ImageDraw.Draw(ring)
    w = int(s * 0.045)
    d.ellipse((w, w, s - 1 - w, s - 1 - w), outline=255, width=w)
    img.paste(grad, (0, 0), ring)
    letters = symbol.split('.')[0]
    letters = ''.join(ch for ch in letters if ch.isalnum()) or '?'
    if len(letters) > 5:
        letters = letters[:3]
    px = {1: 0.56, 2: 0.44, 3: 0.34, 4: 0.27, 5: 0.22}[len(letters)]
    f = font(int(s * px))
    text = Image.new('L', (s, s), 0)
    td = ImageDraw.Draw(text)
    l, t, r, b = td.textbbox((0, 0), letters, font=f)
    td.text(((s - (r - l)) / 2 - l, (s - (b - t)) / 2 - t), letters, font=f, fill=255)
    img.paste(grad, (0, 0), text)
    return img.resize((SIZE, SIZE), Image.LANCZOS)


def fetch_image(url):
    if url.startswith('ipfs://'):
        url = 'https://ipfs.io/ipfs/' + url[len('ipfs://'):].lstrip('/')
    req = urllib.request.Request(url, headers={'User-Agent': 'gully-token-lists/1.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = r.read(5_000_000)
    im = Image.open(io.BytesIO(data)).convert('RGBA')
    side = min(im.size)
    left, top = (im.width - side) // 2, (im.height - side) // 2
    return im.crop((left, top, left + side, top + side)).resize((SIZE, SIZE), Image.LANCZOS)


def main():
    todo_path = os.path.join(LOGOS, 'todo.json')
    if not os.path.exists(todo_path):
        sys.exit('no logos/todo.json: run node build.mjs --dry-run first')
    todo = json.load(open(todo_path, encoding='utf8'))
    out_dir = os.path.join(LOGOS, str(todo['chainId']))
    os.makedirs(out_dir, exist_ok=True)
    for t in todo['tokens']:
        dest = os.path.join(out_dir, t['address'] + '.png')
        if os.path.exists(dest) or os.path.exists(dest[:-4] + '.svg'):
            continue
        img, how = None, 'generated mark'
        if t.get('image'):
            try:
                img, how = fetch_image(t['image']), 'launch image ' + t['image']
            except Exception as e:  # noqa: BLE001
                print(f"  {t['symbol']}: launch image failed ({e}), generating a mark")
        if img is None:
            img = mark(t['address'], t['symbol'])
        img.save(dest, 'PNG', optimize=True)
        print(f"  {t['symbol']:8} {t['address']}: {how} -> logos/{todo['chainId']}/{os.path.basename(dest)} ({os.path.getsize(dest)} bytes)")


if __name__ == '__main__':
    main()
