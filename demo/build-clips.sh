#!/usr/bin/env bash
# Turns the cards from demo/build-cards.py into four 1080p clips in demo/out/. Needs ffmpeg.
# Clip lengths can be set to fit a voiceover: D1 (intro), D2 (never invents), R1..R4 (the four rows), D4 (end card).
#   python3 demo/build-cards.py && bash demo/build-clips.sh          (silent clips, default lengths)
# demo/build-final.sh calls this with lengths measured from the voiceover.
set -euo pipefail
O=demo/out; V=public/nib/intro.mp4; FPS=30
D1=${D1:-10}; D2=${D2:-9}; R1=${R1:-5.6}; R2=${R2:-5.6}; R3=${R3:-5.6}; R4=${R4:-5.6}; D4=${D4:-11}
enc="-c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -r $FPS -movflags +faststart -an"
calc() { awk "BEGIN{printf \"%.3f\", $1}"; }

# 1. opening: the greeting clip (looped) on the left, title on the right
ffmpeg -v error -y -loop 1 -i $O/bg.png -stream_loop -1 -i $V -loop 1 -i $O/intro_mask.png -loop 1 -i $O/intro_text.png -filter_complex \
 "[1:v]scale=860:860,format=rgba[v];[2:v]format=gray[m];[v][m]alphamerge[va];[0:v][va]overlay=70:110[a];[a][3:v]overlay=0:0:format=auto,fade=t=in:color=0xfaf3df:st=0:d=0.6,fade=t=out:color=0xfaf3df:st=$(calc "$D1-0.6"):d=0.6[o]" \
 -map "[o]" -t $D1 $enc $O/01-intro.mp4

# 2. "it never makes up a price" (slow push-in)
ffmpeg -v error -y -loop 1 -i $O/rule.png -vf "zoompan=z='min(zoom+0.00035,1.045)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=$(calc "$D2*$FPS"):s=1920x1080:fps=$FPS,fade=t=in:color=0xfaf3df:st=0:d=0.6,fade=t=out:color=0xfaf3df:st=$(calc "$D2-0.6"):d=0.6" \
 -t $D2 $enc $O/02-never-invents.mp4

# 3. built with ComfyUI: four rows revealed one by one
T=$(calc "$R1+$R2+$R3+$R4-1.2")
ffmpeg -v error -y -loop 1 -t $R1 -i $O/built_1.png -loop 1 -t $R2 -i $O/built_2.png -loop 1 -t $R3 -i $O/built_3.png -loop 1 -t $R4 -i $O/built_4.png -filter_complex \
 "[0:v][1:v]xfade=transition=fade:duration=0.4:offset=$(calc "$R1-0.4")[x1];[x1][2:v]xfade=transition=fade:duration=0.4:offset=$(calc "$R1+$R2-0.8")[x2];[x2][3:v]xfade=transition=fade:duration=0.4:offset=$(calc "$R1+$R2+$R3-1.2"),fade=t=in:color=0xfaf3df:st=0:d=0.5,fade=t=out:color=0xfaf3df:st=$(calc "$T-0.6"):d=0.6[o]" \
 -map "[o]" $enc $O/03-built-with-comfyui.mp4

# 4. end card with the links
ffmpeg -v error -y -loop 1 -i $O/outro_text.png -stream_loop -1 -i $V -loop 1 -i $O/outro_mask.png -filter_complex \
 "[1:v]scale=600:600,format=rgba[v];[2:v]scale=600:600,format=gray[m];[v][m]alphamerge[va];[0:v][va]overlay=1290:250,fade=t=in:color=0xfaf3df:st=0:d=0.6,fade=t=out:color=0xfaf3df:st=$(calc "$D4-0.8"):d=0.8[o]" \
 -map "[o]" -t $D4 $enc $O/04-end-card.mp4
for f in $O/0*.mp4; do printf "%s  " "$f"; ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"; done
