#!/usr/bin/env python3
"""Create app favicon (src/app/icon.png) from the uploaded brand logo.
Applies a rounded-corner alpha mask so corners are transparent, resizes to 256x256."""
from PIL import Image, ImageDraw

SRC = "/home/z/my-project/upload/pasted_image_1788289442384.png"
OUT = "/home/z/my-project/src/app/icon.png"

img = Image.open(SRC).convert("RGBA")
print("source size:", img.size)

# work at high res then downscale for crisp edges
big = img.resize((1024, 1024), Image.LANCZOS)

# rounded-corner mask (radius ~22% like the brand app-icon look)
mask = Image.new("L", (1024, 1024), 0)
d = ImageDraw.Draw(mask)
d.rounded_rectangle([0, 0, 1023, 1023], radius=225, fill=255)
big.putalpha(mask)

out = big.resize((256, 256), Image.LANCZOS)
out.save(OUT, "PNG")
print("written:", OUT)

# also drop a copy in public for reference use
out.save("/home/z/my-project/public/icon-256.png", "PNG")
print("written: /home/z/my-project/public/icon-256.png")
