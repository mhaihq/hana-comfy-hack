# Cuts the recorded call (demo/out/rec, from demo/record-call.js) down to about a minute and joins it with the
# other clips into the finished video.
#   python3 demo/edit-call.py
# Cut points are sentence ends in Higgsy's answers (found from the audio), so nothing is clipped mid-word.
# All times are seconds in the page recording; the red flash at the start ties the video, the audio captured in
# the page and the caller's questions to one clock.
import glob, json, subprocess, os

O = "demo/out"; R = f"{O}/rec"; F = f"{O}/final"; os.makedirs(F, exist_ok=True)
log = json.load(open(f"{R}/log.json")); seg_info = json.load(open(f"{R}/segments.json"))
video = glob.glob(f"{R}/video/*.webm")[0]
TF = 2.88                                    # video time of the first red-flash frame (measured)
vt = lambda epoch: TF + (epoch - log["flashEpoch"]) / 1000.0
at0 = seg_info["at0"] - 0.10                 # where agent.wav starts, in video time (0.1 s earlier: the mouth animation leads her voice slightly)
q = {e["q"]: e for e in log["events"] if e["ev"] == "question"}
W = lambda x: os.path.abspath(x)

# 1. one audio track on the video's clock: Higgsy (captured in the page) + the four questions
inputs = ["-i", f"{R}/agent.wav"]; parts = [f"[0:a]loudnorm=I=-16:LRA=7:TP=-1.5,aresample=48000,aformat=channel_layouts=mono,adelay={int(at0*1000)}|{int(at0*1000)}[g]"]
labels = ["[g]"]
for i, k in enumerate(["q1", "q2", "q3", "q4"], start=1):
    inputs += ["-i", f"demo/out/caller/{k}.wav"]
    d = int(vt(q[k]["epoch"]) * 1000)
    parts.append(f"[{i}:a]volume=1.15,aresample=48000,aformat=channel_layouts=mono,adelay={d}|{d}[c{i}]"); labels.append(f"[c{i}]")
parts.append("".join(labels) + f"amix=inputs=5:normalize=0:duration=longest[m]")
subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(parts), "-map", "[m]", "-t", "130", "-ar", "48000", f"{R}/call_full.wav"], check=True)

# 2. the cuts (video seconds): click, Q1, Q2, Q3 (waiting gap trimmed), Q4 with the image
cuts = [(5.5, 8.15), (16.1, 32.7), (42.8, 62.1), (77.1, 80.3), (82.0, 88.5), (103.5, 119.4)]
v, a, off, offs = [], [], 0.0, []
for i, (s, e) in enumerate(cuts):
    d = e - s; offs.append(off)
    v.append(f"[0:v]trim=start={s}:end={e},setpts=PTS-STARTPTS,fps=30,scale=1920:1080:flags=lanczos[v{i}]")
    a.append(f"[1:a]atrim=start={s}:end={e},asetpts=PTS-STARTPTS,afade=t=in:d=0.05,afade=t=out:st={d-0.14:.3f}:d=0.14[a{i}]")
    off += d
total = off
def out_time(t):                              # video time -> time in the joined call
    for (s, e), o in zip(cuts, offs):
        if s <= t <= e: return o + (t - s)
    return None
cat = "".join(f"[v{i}][a{i}]" for i in range(len(cuts))) + f"concat=n={len(cuts)}:v=1:a=1[cv][ca]"

# 3. captions for the questions, and a one-line label that the caller's voice is synthesized
FONT = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
texts = {"q1": "What does the Plus plan cost?", "q2": "How do I cancel my subscription?", "q3": "How much is the Mega Ultra plan?", "q4": "Show me an example: a small red paper boat"}
dt = []
for k, t in texts.items():
    s = out_time(vt(q[k]["epoch"])); e = s + q[k]["dur"] + 0.6
    dt.append(f"drawtext=fontfile={FONT}:text='{t}':fontsize=38:fontcolor=white:box=1:boxcolor=0x2fb5a0@0.96:boxborderw=20:x=(576-text_w/2):y=120:enable='between(t,{s:.2f},{e:.2f})'")
dt.append(f"drawtext=fontfile={FONT}:text='Live call · the caller’s voice is synthesized':fontsize=27:fontcolor=0x4a5b57:x=40:y=1034:enable='between(t,0.3,5.5)'")
vf = f"[cv]{','.join(dt)},fade=t=in:st=0:d=0.35,fade=t=out:st={total-0.4:.2f}:d=0.4[fv];[ca]afade=t=in:st=0:d=0.3,afade=t=out:st={total-0.4:.2f}:d=0.4,aformat=channel_layouts=stereo[fa]"
fc = ";".join(v + a + [cat, vf])
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-i", f"{R}/call_full.wav", "-filter_complex", fc, "-map", "[fv]", "-map", "[fa]", "-c:v", "libx264", "-crf", "18", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", f"{F}/05-live-call.mp4"], check=True)
print(f"live call segment: {total:.1f} s")

# 4. join: intro, never-invents, live call, built-with, end card
order = ["01-intro", "02-never-invents", "05-live-call", "03-built-with-comfyui", "04-end-card"]
args = []; chain = ""
for i, n in enumerate(order):
    args += ["-i", f"{F}/{n}.mp4"]
    chain += f"[{i}:v]fps=30,scale=1920:1080,format=yuv420p,setsar=1[v{i}];[{i}:a]aresample=48000,aformat=channel_layouts=stereo[a{i}];"
chain += "".join(f"[v{i}][a{i}]" for i in range(len(order))) + f"concat=n={len(order)}:v=1:a=1[v][a]"
subprocess.run(["ffmpeg", "-v", "error", "-y", *args, "-filter_complex", chain, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "19", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", f"{F}/ask-higgsy-demo.mp4"], check=True)
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f"{F}/ask-higgsy-demo.mp4"], capture_output=True, text=True).stdout)
print(f"final video: {dur:.1f} s ({int(dur//60)}:{int(dur%60):02d}), limit 2:00")
