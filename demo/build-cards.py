# Builds the title/explainer cards for the demo video (static PNGs), in the same cream-and-teal style as the app.
# Needs Pillow and the Inter font. Run from the repo root:  python3 demo/build-cards.py
# Then demo/build-clips.sh turns them into mp4 clips with ffmpeg.
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

W, H = 1920, 1080
CREAM, INK, TEAL, TEAL_D, CARD, LINE = (251, 243, 223), (29, 43, 42), (47, 181, 160), (31, 138, 121), (255, 250, 240), (234, 223, 195)
F = "/usr/share/fonts/opentype/inter/Inter-%s.otf"
font = lambda w, s: ImageFont.truetype(F % w, s)
OUT = "demo/out"
os.makedirs(OUT, exist_ok=True)
NIB = "public/nib"

def canvas(): return Image.new("RGB", (W, H), CREAM)

def text(d, xy, s, f, fill=INK, anchor="la"): d.text(xy, s, font=f, fill=fill, anchor=anchor)

def wrap(d, s, f, width):
    lines, cur = [], ""
    for w in s.split():
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) <= width: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def pill(d, box, fill, outline=None, r=None):
    d.rounded_rectangle(box, radius=r or (box[3] - box[1]) // 2, fill=fill, outline=outline, width=3 if outline else 0)

def shadowed(im, base, xy, blur=24, off=(0, 14), alpha=70):
    a = base.getchannel("A").point(lambda v: v * alpha // 255)
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0)); layer.paste((40, 60, 56, 255), (xy[0] + off[0], xy[1] + off[1]), a)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(im, layer)

# ---------- 1. intro: text layer (the greeting clip sits on the left in ffmpeg) ----------
def fit(d, s_, weight, size, maxw):
    while d.textlength(s_, font=font(weight, size)) > maxw: size -= 2
    return font(weight, size)
im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
X, MAXW = 990, 830
text(d, (X, 250), "Ask Higgsy", fit(d, "Ask Higgsy", "ExtraBold", 160, MAXW))
text(d, (X + 4, 440), "A voice guide to Higgsfield.", fit(d, "A voice guide to Higgsfield.", "Medium", 58, MAXW))
text(d, (X + 4, 520), "Ask it anything.", fit(d, "Ask it anything.", "SemiBold", 48, MAXW), TEAL_D)
text(d, (X + 4, 580), "It never invents a price.", fit(d, "It never invents a price.", "SemiBold", 48, MAXW), TEAL_D)
pill(d, (X + 4, 710, X + 4 + 800, 710 + 84), CARD, LINE)
text(d, (X + 4 + 400, 752), "Built with ComfyUI  ·  #OpenSourceHiggsfield", fit(d, "Built with ComfyUI  ·  #OpenSourceHiggsfield", "SemiBold", 33, 740), INK, "mm")
im.save(f"{OUT}/intro_text.png")
# soft round mask for the greeting clip
m = Image.new("L", (860, 860), 0); ImageDraw.Draw(m).ellipse((20, 20, 840, 840), fill=255); m.filter(ImageFilter.GaussianBlur(40)).save(f"{OUT}/intro_mask.png")
canvas().save(f"{OUT}/bg.png")

# ---------- 2. the rule ----------
im = canvas().convert("RGBA"); d = ImageDraw.Draw(im)
hig = Image.open(f"{NIB}/higgsy.png").convert("RGBA"); hig = hig.crop(hig.getchannel("A").getbbox()); hig = hig.resize((round(hig.width * 760 / hig.height), 760), Image.LANCZOS)
pos = (150, 190); im = shadowed(im, hig, pos); im.alpha_composite(hig, pos); d = ImageDraw.Draw(im)
text(d, (880, 150), "It never makes up", font("ExtraBold", 96)); text(d, (880, 255), "a price.", font("ExtraBold", 96), TEAL_D)
# chat bubbles
u = "How much is the Mega Ultra plan?"; fu = font("Medium", 44); tw = d.textlength(u, font=fu)
pill(d, (1820 - tw - 80, 430, 1820, 430 + 96), TEAL); text(d, (1820 - 40, 478), u, fu, (255, 255, 255), "rm")
a = "I couldn't find that plan, so I won't guess. Here's Higgsfield's pricing page."; fa = font("Medium", 44)
lines = wrap(d, a, fa, 780); hh = 40 + 58 * len(lines)
d.rounded_rectangle((880, 580, 880 + 860, 580 + hh), radius=44, fill=CARD, outline=LINE, width=3)
for i, l in enumerate(lines): text(d, (920, 612 + i * 58), l, fa)
fy = 580 + hh + 44
for i, l in enumerate(wrap(d, "Facts come only from Higgsfield's own pages, with the date.", font("Medium", 38), 900)): text(d, (880, fy + i * 50), l, font("Medium", 38), (92, 110, 106))
im.convert("RGB").save(f"{OUT}/rule.png")

# ---------- 3. built with ComfyUI (progressive reveal) ----------
def thumb(path, size, checker=False, crop=None):
    t = Image.open(path).convert("RGBA")
    if crop: t = t.crop(crop)
    if checker:
        bg = Image.new("RGBA", t.size, (255, 255, 255, 255)); dd = ImageDraw.Draw(bg); s = max(10, t.width // 14)
        for yy in range(0, t.height, s):
            for xx in range(0, t.width, s):
                if (xx // s + yy // s) % 2: dd.rectangle((xx, yy, xx + s, yy + s), fill=(222, 222, 222, 255))
        bg.alpha_composite(t); t = bg
    t = t.convert("RGB"); side = max(t.size)
    sq = Image.new("RGB", (side, side), CREAM if not checker else (255, 255, 255)); sq.paste(t, ((side - t.width) // 2, (side - t.height) // 2)); t = sq.resize((size, size), Image.LANCZOS)
    mk = Image.new("L", (size, size), 0); ImageDraw.Draw(mk).rounded_rectangle((0, 0, size, size), radius=28, fill=255)
    out = Image.new("RGBA", (size, size)); out.paste(t, (0, 0), mk); return out

rows = [
    ("Higgsy herself", "Z-Image-Turbo, open weights, on Comfy Cloud", thumb(f"{NIB}/base.png", 130)),
    ("A clean cutout", "BiRefNet background removal", thumb(f"{NIB}/higgsy.png", 130, checker=True)),
    ("The greeting clip", "LTX-2.3 image to video", thumb(f"{NIB}/intro-poster.jpg", 130)),
    ("Live demos inside the call", "Comfy Cloud API, with the workflow linked under every image", thumb("/tmp/demo.png", 130) if os.path.exists("/tmp/demo.png") else thumb(f"{NIB}/base.png", 130)),
]
for state in range(1, 5):
    im = canvas().convert("RGBA"); d = ImageDraw.Draw(im)
    text(d, (140, 70), "Everything you see was made with", font("ExtraBold", 62)); text(d, (140, 150), "ComfyUI", font("ExtraBold", 62), TEAL_D)
    for i in range(state):
        y = 290 + i * 172
        title, sub, th = rows[i]
        d.rounded_rectangle((120, y - 12, 1800, y + 148), radius=36, fill=CARD, outline=LINE, width=3)
        im.alpha_composite(th, (150, y + 3))
        text(d, (320, y + 14), title, font("ExtraBold", 48)); text(d, (320, y + 80), sub, font("Medium", 36), (86, 104, 100))
    if state == 4:
        text(d, (140, 1000), "Every workflow is in the repo. Run it on Comfy Cloud or your own ComfyUI.", font("SemiBold", 36), TEAL_D)
    im.convert("RGB").save(f"{OUT}/built_{state}.png")

# ---------- 4. outro ----------
im = canvas().convert("RGBA"); d = ImageDraw.Draw(im)
text(d, (140, 130), "Try it", font("ExtraBold", 110))
pill(d, (140, 290, 1280, 400), CARD, LINE); text(d, (190, 345), "hana-comfy-hack.vercel.app", font("ExtraBold", 62), TEAL_D, "lm")
text(d, (140, 470), "Open source (MIT)", font("ExtraBold", 70))
pill(d, (140, 590, 1280, 700), CARD, LINE); text(d, (190, 645), "github.com/mhaihq/hana-comfy-hack", font("SemiBold", 54), INK, "lm")
text(d, (140, 790), "#OpenSourceHiggsfield", font("ExtraBold", 80), TEAL_D)
text(d, (140, 930), "Unofficial community project, not affiliated with Higgsfield.", font("Medium", 34), (92, 110, 106))
text(d, (140, 980), "Character, clips and demos made with ComfyUI. Lip sync adapted from Unstuck (MIT).", font("Medium", 34), (92, 110, 106))
im.convert("RGB").save(f"{OUT}/outro_text.png")
im2 = Image.new("L", (640, 640), 0); ImageDraw.Draw(im2).ellipse((14, 14, 626, 626), fill=255); im2.filter(ImageFilter.GaussianBlur(30)).save(f"{OUT}/outro_mask.png")
print("cards written to", OUT)
