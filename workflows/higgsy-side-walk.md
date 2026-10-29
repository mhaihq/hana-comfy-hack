# Higgsy's side-view walk (three ComfyUI steps)

Used by the "thinking" and idle strolls: Higgsy turns side-on, walks a few steps left, turns, walks right.

1. **Side profile still.** Template `image_qwen_image_edit_2511_int8` (Qwen-Image-Edit 2511, open weights) on `public/nib/base.png`. Overrides: `41.image` (the input) and `170:151.prompt`:
   > Turn this exact character to a perfect side profile view facing left, full body, standing on both feet in a relaxed walking posture. Seen purely from the side with the face turned left in profile showing one eye and a small smile, one small arm visible at its side. Keep the exact same character design, teal and yellow colors, smooth 3D animated-film look and soft lighting. Replace the cream background with a perfectly flat solid pure magenta (#FF00FF) background with no ground shadow and no gradient.

   Result: `public/nib/src/side_raw.png`. (I first tried the FLUX 3 Klein edit template; it failed validation on the cloud before running, so Qwen did this step.)
2. **Walk in place.** Template `video_ltx2_3_i2v` (LTX-2.3) on that still, 768 x 768, 4 seconds. Prompt:
   > The cute round teal ink-drop creature walks calmly in place in perfect side view, facing left, taking slow thoughtful steps with its small feet alternating, a gentle rhythmic body bob and a slight sway of its small arm, like a person pacing while thinking. Static camera, the character stays centered in frame and does not leave it, plain flat solid magenta background, same character design throughout, smooth animated-film style, no audio.

   Node overrides as in `intro-video.ltx2_3_i2v.md` (`269.image`, `320:312` width, `320:299` height, `320:301` seconds, `320:319` prompt). Result: `public/nib/src/walk_raw.mp4`.
3. **Transparent sprite.** `scripts/key-walk.py` keys out the magenta, removes the purple light the backdrop bounced onto the body, sharpens lightly and writes `public/nib/walk.webp` (43 frames, 12 fps, native 510 x 689, with alpha). Resizing the video down made it noticeably softer, so the sprite keeps the video's own resolution.

The page does the rest (`src/components/Higgsy.tsx`): the sprite faces left, is mirrored for walking right, and moves across the stage while it plays. A turn squashes the side view narrow, flips it, and squashes it back out; going to or from the front view is a short crossfade. A small waddle (bob and tilt) on each step helps the footwork read.
