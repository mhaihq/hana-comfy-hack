# Reads the recording from demo/record-call.js and writes demo/out/rec/analysis.json:
#   TF       video time of the first red-flash frame (the shared clock)
#   at0      where Higgsy's captured audio starts, in video time
#   seg      Higgsy's speech segments (pauses of 0.28 s or more split them), in video time
#   events   the call events, in video time
# Use it to choose cut points at sentence ends for demo/edit-call.py.
import glob, json, re, subprocess
import numpy as np

R = "demo/out/rec"
V = glob.glob(f"{R}/video/*.webm")[0]
log = json.load(open(f"{R}/log.json"))
raw = subprocess.run(["ffmpeg", "-v", "error", "-t", "12", "-i", V, "-vf", "fps=25,scale=16:9", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
fr = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 9, 16, 3).astype(float)
red = (fr[..., 0].mean(axis=(1, 2)) > 180) & (fr[..., 1].mean(axis=(1, 2)) < 80)
TF = float(np.where(red)[0][0]) / 25
vt = lambda e: TF + (e - log["flashEpoch"]) / 1000.0
at0 = vt(log["recStart"])
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{R}/agent.webm", "-ar", "44100", "-ac", "1", f"{R}/agent.wav"], check=True)
out = subprocess.run(["ffmpeg", "-hide_banner", "-i", f"{R}/agent.wav", "-af", "silencedetect=noise=-38dB:d=0.28", "-f", "null", "-"], capture_output=True, text=True).stderr
sil = [(float(a), float(b)) for a, b in re.findall(r"silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)", out)]
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f"{R}/agent.wav"], capture_output=True, text=True).stdout)
seg, t = [], 0.0
for a, b in sil:
    if a - t > 0.15: seg.append((at0 + t, at0 + a))
    t = b
if dur - t > 0.15: seg.append((at0 + t, at0 + dur))
ev = []
for e in log["events"]:
    if e["ev"] in ("click-call", "live", "greeting-done", "question", "answer-done", "image-visible", "hang-up"):
        ep = e.get("endedAt") if e["ev"] in ("greeting-done", "answer-done") and e.get("endedAt") else e["t"]
        ev.append({"ev": e["ev"], "q": e.get("q", ""), "t": round(vt(ep), 2), "dur": e.get("dur")})
json.dump({"TF": TF, "at0": at0, "seg": [[round(a, 2), round(b, 2)] for a, b in seg], "events": ev}, open(f"{R}/analysis.json", "w"), indent=1)
print(f"flash at {TF:.2f}s, agent audio starts at {at0:.2f}s")
for e in ev: print("  %-14s %-3s %7.2f" % (e["ev"], e["q"], e["t"]))
print("speech segments:"); [print("  %2d  %6.2f - %6.2f  (%.1fs)" % (i, a, b, b - a)) for i, (a, b) in enumerate(seg)]
