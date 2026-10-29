#!/usr/bin/env bash
# Turns the cards from demo/build-cards.py into four 1080p clips in demo/out/. Needs ffmpeg.
# Run from the repo root:  python3 demo/build-cards.py && bash demo/build-clips.sh
set -euo pipefail
O=demo/out; V=public/nib/intro.mp4; FPS=30
enc="-c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -r $FPS -movflags +faststart -an"

# 1. opening: the greeting clip (looped) on the left, title on the right  (10 s)
ffmpeg -v error -y -loop 1 -i $O/bg.png -stream_loop -1 -i $V -loop 1 -i $O/intro_mask.png -loop 1 -i $O/intro_text.png -filter_complex \
 "[1:v]scale=860:860,format=rgba[v];[2:v]format=gray[m];[v][m]alphamerge[va];[0:v][va]overlay=70:110[a];[a][3:v]overlay=0:0:format=auto,fade=t=in:st=0:d=0.6,fade=t=out:st=9.4:d=0.6[o]" \
 -map "[o]" -t 10 $enc $O/01-intro.mp4

# 2. "it never makes up a price"  (9 s, slow push-in)
ffmpeg -v error -y -loop 1 -i $O/rule.png -vf "zoompan=z='min(zoom+0.00035,1.045)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=270:s=1920x1080:fps=$FPS,fade=t=in:st=0:d=0.6,fade=t=out:st=8.4:d=0.6" \
 -t 9 $enc $O/02-never-invents.mp4

# 3. built with ComfyUI: four rows revealed one by one  (~21 s)
ffmpeg -v error -y $(for i in 1 2 3 4; do echo -n "-loop 1 -t 5.6 -i $O/built_$i.png "; done) -filter_complex \
 "[0:v][1:v]xfade=transition=fade:duration=0.4:offset=5.2[x1];[x1][2:v]xfade=transition=fade:duration=0.4:offset=10.4[x2];[x2][3:v]xfade=transition=fade:duration=0.4:offset=15.6,fade=t=in:st=0:d=0.5,fade=t=out:st=20.0:d=0.6[o]" \
 -map "[o]" $enc $O/03-built-with-comfyui.mp4

# 4. end card with the links  (11 s)
ffmpeg -v error -y -loop 1 -i $O/outro_text.png -stream_loop -1 -i $V -loop 1 -i $O/outro_mask.png -filter_complex \
 "[1:v]scale=600:600,format=rgba[v];[2:v]scale=600:600,format=gray[m];[v][m]alphamerge[va];[0:v][va]overlay=1290:250,fade=t=in:st=0:d=0.6,fade=t=out:st=10.2:d=0.8[o]" \
 -map "[o]" -t 11 $enc $O/04-end-card.mp4
for f in $O/0*.mp4; do printf "%s  " "$f"; ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"; done
