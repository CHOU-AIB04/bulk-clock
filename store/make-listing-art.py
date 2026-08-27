"""
Play Store feature graphic.

1024 × 500, the app's own mark and palette. Run from the repo root:

    python3 store/make-listing-art.py
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "android", "app", "src", "main", "res"))

from PIL import Image, ImageDraw, ImageFilter, ImageFont

LIME = (212, 255, 61, 255)
DARK = (15, 19, 20, 255)
W, H = 1024, 500
SS = 4


def draw_mark(d, cx, cy, r, colour, ring_ratio=0.26, angle=-30):
    import math
    stroke = r * ring_ratio
    inner = r - stroke
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=colour)
    d.ellipse([cx - inner, cy - inner, cx + inner, cy + inner], fill=(0, 0, 0, 0))

    a = inner * 0.80
    bar_h = inner * 0.105
    plate_cx = a * 0.60
    plate_w = inner * 0.125
    plate_h = inner * 0.36

    rad = math.radians(angle)
    cos, sin = math.cos(rad), math.sin(rad)
    place = lambda x, y: (cx + x * cos - y * sin, cy + x * sin + y * cos)
    poly = lambda x0, y0, x1, y1: [place(x0, y0), place(x1, y0), place(x1, y1), place(x0, y1)]

    d.polygon(poly(-a, -bar_h, a, bar_h), fill=colour)
    for sign in (-1, 1):
        d.polygon(poly(sign * plate_cx - plate_w, -plate_h, sign * plate_cx + plate_w, plate_h), fill=colour)


def font(size, bold=True):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


img = Image.new("RGBA", (W * SS, H * SS), DARK)

glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([-200 * SS, -260 * SS, 620 * SS, 500 * SS], fill=(212, 255, 61, 30))
glow = glow.filter(ImageFilter.GaussianBlur(120 * SS // 2))
img = Image.alpha_composite(img, glow)

d = ImageDraw.Draw(img)
draw_mark(d, 190 * SS, 250 * SS, 118 * SS, LIME)

# Measured rather than guessed: a subtitle that runs off a 1024px canvas is the
# classic feature-graphic mistake, and Play crops rather than scales.
title_f = font(74 * SS)
sub_f = font(29 * SS, bold=False)

d.text((358 * SS, 158 * SS), "Bulk Clock", font=title_f, fill=(242, 244, 240, 255))
d.text((360 * SS, 258 * SS), "Meals, macros and every set — offline.", font=sub_f, fill=(185, 192, 184, 255))
d.text((360 * SS, 304 * SS), "No account. Nothing uploaded.", font=sub_f, fill=(212, 255, 61, 255))

for y, text in ((258, "Meals, macros and every set — offline."), (304, "No account. Nothing uploaded.")):
    right = 360 * SS + d.textlength(text, font=sub_f)
    assert right < (W - 24) * SS, f"subtitle overflows the canvas: {right / SS:.0f}px"

out = os.path.join(os.path.dirname(__file__), "feature-graphic.png")
img.resize((W, H), Image.LANCZOS).convert("RGB").save(out, "PNG")
print("wrote", out)
