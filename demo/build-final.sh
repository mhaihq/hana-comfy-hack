#!/usr/bin/env bash
# Sizes the four clips to the voiceover in demo/out/vo/ (python3 demo/make-voiceover.py first), then mixes the voice in.
# Output: demo/out/final/*.mp4 with sound.   Run from the repo root.
set -euo pipefail
O=demo/out; VO=$O/vo; F=$O/final; mkdir -p $F
dur() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }
calc() { awk "BEGIN{printf \"%.3f\", $1}"; }
max() { awk "BEGIN{a=$1;b=$2;print (a>b)?a:b}"; }
d1=$(dur $VO/1_intro.mp3); d2=$(dur $VO/2_rule.mp3); da=$(dur $VO/3a_art.mp3); db=$(dur $VO/3b_cut.mp3); dc=$(dur $VO/3c_ltx.mp3); dd=$(dur $VO/3d_live.mp3); d4=$(dur $VO/4_outro.mp3)
export D1=$(max 10 $(calc "0.8+$d1+1.0")) D2=$(max 9 $(calc "0.6+$d2+0.9"))
export R1=$(max 5.2 $(calc "$da+1.0")) R2=$(max 3.8 $(calc "$db+1.0")) R3=$(max 5.2 $(calc "$dc+1.0")) R4=$(max 5.2 $(calc "$dd+1.5"))
export D4=$(max 11 $(calc "0.8+$d4+1.3"))
echo "lengths: D1=$D1 D2=$D2 R=$R1/$R2/$R3/$R4 D4=$D4"
bash demo/build-clips.sh >/dev/null

norm="loudnorm=I=-16:LRA=7:TP=-1.5,aresample=44100,aformat=channel_layouts=mono"
mux1() { # clip, vo, start-seconds, out
  local vd; vd=$(dur "$1")
  ffmpeg -v error -y -i "$1" -i "$2" -filter_complex "[1:a]$norm,adelay=$(calc "$3*1000")|$(calc "$3*1000"),apad=whole_dur=$vd[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -t $vd "$4"; }
mux1 $O/01-intro.mp4 $VO/1_intro.mp3 0.8 $F/01-intro.mp4
mux1 $O/02-never-invents.mp4 $VO/2_rule.mp3 0.6 $F/02-never-invents.mp4
mux1 $O/04-end-card.mp4 $VO/4_outro.mp3 0.8 $F/04-end-card.mp4
# clip 3: each line starts with its row
s2=$(calc "$R1-0.4"); s3=$(calc "$R1+$R2-0.8"); s4=$(calc "$R1+$R2+$R3-1.2")
ms() { calc "($1+0.35)*1000"; }
vd3=$(dur $O/03-built-with-comfyui.mp4)
# build the four-line audio track on its own first (mixing it straight into the video drops the audio), then attach it
ffmpeg -v error -y -i $VO/3a_art.mp3 -i $VO/3b_cut.mp3 -i $VO/3c_ltx.mp3 -i $VO/3d_live.mp3 -filter_complex \
 "[0:a]$norm,adelay=$(ms 0)|$(ms 0)[a1];[1:a]$norm,adelay=$(ms $s2)|$(ms $s2)[a2];[2:a]$norm,adelay=$(ms $s3)|$(ms $s3)[a3];[3:a]$norm,adelay=$(ms $s4)|$(ms $s4)[a4];[a1][a2][a3][a4]amix=inputs=4:normalize=0:duration=longest,apad=whole_dur=$vd3[m]" \
 -map "[m]" -t $vd3 $O/_clip3_audio.wav
ffmpeg -v error -y -i $O/03-built-with-comfyui.mp4 -i $O/_clip3_audio.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -t $vd3 $F/03-built-with-comfyui.mp4
for f in $F/*.mp4; do printf "%s  video+audio %ss\n" "$f" "$(dur "$f")"; done
