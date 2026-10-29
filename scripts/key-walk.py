# Turns the LTX walk video (flat magenta background) into public/nib/walk.webp: an animated WebP with a
# transparent background. Needs ffmpeg, Pillow and numpy.
#   ffmpeg -ss 0.3 -i public/nib/src/walk_raw.mp4 -vf fps=12 /tmp/wf/f_%03d.png     (mkdir /tmp/wf first)
#   python3 scripts/key-walk.py
# The key is "how magenta is this pixel": min(R-G, B-G) is large for the background and negative for the teal
# body, yellow face and peach cheeks. Edge pixels get the background colour unmixed so no pink rim is left.
import glob
import numpy as np
from PIL import Image, ImageFilter

files = sorted(glob.glob("/tmp/wf/f_*.png"))

def key(path):
    im = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    corners = np.concatenate([im[:40, :40].reshape(-1, 3), im[:40, -40:].reshape(-1, 3), im[200:240, :40].reshape(-1, 3)])
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
    return Image.fromarray(np.dstack([col, a * 255]).astype(np.uint8), "RGBA")

frames = [key(f) for f in files]
boxes = [f.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox() for f in frames]
x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
box = (max(0, x0 - 8), max(0, y0 - 8), min(768, x1 + 8), min(768, y1 + 8))
W = 420
H = round((box[3] - box[1]) * W / (box[2] - box[0]))
frames = [f.crop(box).resize((W, H), Image.LANCZOS) for f in frames]
frames[0].save("public/nib/walk.webp", save_all=True, append_images=frames[1:], duration=83, loop=0, quality=78, method=4)
print(len(frames), "frames", W, "x", H)
