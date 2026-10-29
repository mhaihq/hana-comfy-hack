# Turns an LTX clip made on a flat magenta background into a transparent, looping animated WebP, and writes
# where it sits relative to the front-view image so the page can line the two up (src/lib/thinkSprite.ts).
#   mkdir -p /tmp/hf && ffmpeg -i public/nib/src/hop_raw.mp4 -vf fps=12 /tmp/hf/f_%03d.png
#   python3 scripts/key-sprite.py /tmp/hf public/nib/think.webp
# The key is "how magenta is this pixel": min(R-G, B-G) is large for the backdrop and negative for the teal body,
# yellow face and peach cheeks. Edge pixels get the backdrop unmixed, and the purple light the backdrop bounced
# onto the body is pulled back to teal. Frames are sharpened last. The loop start/end are the closest pair of
# frames, so it repeats without a visible jump.
import glob, sys
import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
files = sorted(glob.glob(f"{src}/f_*.png"))

def key(path):
    im = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    corners = np.concatenate([im[:40, :40].reshape(-1, 3), im[:40, -40:].reshape(-1, 3), im[-40:, :40].reshape(-1, 3), im[-40:, -40:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    R, G, B = im[..., 0], im[..., 1], im[..., 2]
    m = np.minimum(R - G, B - G)
    mbg = min(bg[0] - bg[1], bg[2] - bg[1])
    lo, hi = 0.22 * mbg, 0.55 * mbg
    a = 1 - np.clip((m - lo) / (hi - lo), 0, 1)
    a = a * a * (3 - 2 * a)
    A = Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    a = np.asarray(A).astype(np.float32) / 255
    col = np.clip((im - (1 - a)[..., None] * bg) / np.maximum(a, 1e-3)[..., None], 0, 255)
    edge = (a > 0) & (a < 0.98)
    r, g, b = col[..., 0], col[..., 1], col[..., 2]
    col[..., 0] = np.where(edge, np.minimum(r, np.maximum(g, b) + 10), r)
    col[..., 2] = np.where(edge, np.minimum(b, g + 55), b)
    # the backdrop bounces purple light onto the body: red and blue both rise above green. Only pixels where
    # that is true are touched (blue above green rules out the yellow face and peach cheeks, red near green rules
    # out the untouched teal body).
    r, g, b = col[..., 0], col[..., 1], col[..., 2]
    spill = (r > g - 25) & (b > g) & (a > 0.3)
    col[..., 0] = np.where(spill, np.minimum(r, g * 0.72), r)
    col[..., 2] = np.where(spill, np.minimum(b, g), b)
    return Image.fromarray(np.dstack([col, a * 255]).astype(np.uint8), "RGBA")

def sharpen(im):
    rgb = im.convert("RGB").filter(ImageFilter.UnsharpMask(radius=1.4, percent=120, threshold=2))
    rgb.putalpha(im.getchannel("A"))
    return rgb

frames = [key(f) for f in files]

# loop: pick the start (early) and end (late) frames that look most alike
small = [np.asarray(f.resize((128, 128))).astype(np.float32) * (np.asarray(f.resize((128, 128)))[..., 3:4] / 255) for f in frames]
n = len(frames)
best = min(((float(np.mean((small[i] - small[j]) ** 2)), i, j) for i in range(0, min(8, n)) for j in range(int(n * 0.6), n)))
_, i0, j0 = best
frames = frames[i0 : j0 + 1]
print(f"loop: frames {i0}..{j0} ({len(frames)} frames, mismatch {best[0]:.1f})")

# drop frames the video itself smeared with motion blur (low edge energy compared with the clip's median)
def energy(im):
    g = np.asarray(im.convert("RGBA").resize((256, 256))).astype(np.float32)
    m = g[..., 3] > 250
    l = g[..., :3].mean(axis=2)
    lap = -4 * l[1:-1, 1:-1] + l[:-2, 1:-1] + l[2:, 1:-1] + l[1:-1, :-2] + l[1:-1, 2:]
    mm = m[1:-1, 1:-1]
    return float(lap[mm].var()) if mm.any() else 0.0
en = [energy(f) for f in frames]
med = float(np.median(en))
print('frame energy / median:', [round(e / med, 2) for e in en])
BLUR_CUT = 0.75
keep = [i for i, e in enumerate(en) if e >= BLUR_CUT * med or i in (0, len(en) - 1)]
print(f"blur filter: kept {len(keep)} of {len(frames)} frames")
frames = [frames[i] for i in keep]

boxes = [f.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox() for f in frames]
x0, y0 = min(b[0] for b in boxes) - 8, min(b[1] for b in boxes) - 8
x1, y1 = max(b[2] for b in boxes) + 8, max(b[3] for b in boxes) + 8
x0, y0, x1, y1 = max(0, x0), max(0, y0), min(frames[0].width, x1), min(frames[0].height, y1)
frames = [sharpen(f.crop((x0, y0, x1, y1))) for f in frames]
frames[0].save(out, save_all=True, append_images=frames[1:], duration=83, loop=0, quality=80, method=5)
print("crop box in the video frame:", (x0, y0, x1 - x0, y1 - y0))
