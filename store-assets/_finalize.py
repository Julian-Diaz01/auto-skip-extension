"""One-off helper used only while generating Chrome Web Store assets for
this repo: resizes a raw browser-automation capture to the exact pixel
dimensions the Store requires (screenshots must be 1280x800; promo tiles
must be exactly 440x280 / 1400x560). Not part of the shipped extension.

Usage: python _finalize.py <source_png> <target_width> <target_height> <output_png>
"""
import sys
from PIL import Image

src, w, h, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
img = Image.open(src).convert("RGB")
img = img.resize((w, h), Image.LANCZOS)
img.save(out, "PNG")
print(f"{out}: {img.size}")
