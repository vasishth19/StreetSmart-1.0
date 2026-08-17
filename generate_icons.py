"""
Generate all PWA icons for StreetSmart.
Run once: python generate_icons.py
Requires: pip install Pillow
"""

from PIL import Image, ImageDraw, ImageFont
import os

SIZES   = [72, 96, 128, 144, 152, 192, 384, 512]
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'icons')

# Colors
BG_COLOR   = (5,  8,  15)   # #05080F
GREEN      = (0,  255, 156)  # #00FF9C
CYAN       = (0,  229, 255)  # #00E5FF

os.makedirs(OUT_DIR, exist_ok=True)

def make_icon(size: int) -> Image.Image:
    img  = Image.new('RGBA', (size, size), BG_COLOR + (255,))
    draw = ImageDraw.Draw(img)

    pad    = int(size * 0.12)
    cx, cy = size // 2, size // 2
    r      = size // 2 - pad

    # Outer circle (neon green)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r],
                 outline=GREEN, width=max(2, size // 32))

    # Inner circle (cyan, smaller)
    r2 = int(r * 0.6)
    draw.ellipse([cx - r2, cy - r2, cx + r2, cy + r2],
                 outline=CYAN, width=max(1, size // 48))

    # Navigation arrow (pointing up-right)
    arrow_size = int(r * 0.55)
    pts = [
        (cx,                  cy - arrow_size),      # top
        (cx + arrow_size,     cy + arrow_size // 2),  # bottom-right
        (cx + arrow_size // 8, cy),                   # inner-right
        (cx - arrow_size,     cy + arrow_size // 2),  # bottom-left
        (cx - arrow_size // 8, cy),                   # inner-left
    ]
    draw.polygon(pts, fill=GREEN)

    # Dot at center
    dot = max(2, size // 32)
    draw.ellipse([cx - dot, cy - dot, cx + dot, cy + dot], fill=CYAN)

    return img

for size in SIZES:
    icon = make_icon(size)
    path = os.path.join(OUT_DIR, f'icon-{size}x{size}.png')
    icon.save(path, 'PNG')
    print(f'✅ Generated: icon-{size}x{size}.png')

# Also save a 32x32 favicon
favicon = make_icon(32)
favicon.save(os.path.join(OUT_DIR, 'icon-32x32.png'), 'PNG')
print('✅ Generated: icon-32x32.png')

# Copy 192x192 as favicon.ico equivalent
favicon_path = os.path.join(OUT_DIR, '..', 'favicon.ico')
make_icon(32).save(favicon_path)
print(f'✅ Generated: favicon.ico')

print(f'\n🎉 All {len(SIZES) + 2} icons generated in {OUT_DIR}')
print('Next step: restart your Next.js dev server')