# Higgsy's thinking hop (ComfyUI, LTX-2.3)

Plays while Higgsy is quietly thinking (waiting on a lookup) or idle. It never plays while Higgsy or the caller is speaking: then Higgsy stays still, facing front, and talks or listens.

1. **Start frame.** `public/nib/src/front_magenta.png`: Higgsy (the original render, mouth included, with the BiRefNet cutout as its matte) at 66% scale on flat magenta, with headroom to hop. Made with Pillow, no model needed.
2. **Hop clip.** Template `video_ltx2_3_i2v` (LTX-2.3, open weights) on that frame, 1024 x 1024, 4 seconds. Node overrides as in `intro-video.ltx2_3_i2v.md` (`269.image`, `320:312` width, `320:299` height, `320:301` seconds, `320:319` prompt). Prompt:
   > The cute round teal ink-drop creature with a yellow face does a gentle happy bounce in place, hopping softly up and down a couple of times and landing back where it started, blinking once and glancing thoughtfully up and to the side, then back to the camera, with a small smile. Calm, smooth motion, no blur. It always faces the camera, keeps the same face and the same size, and stays fully inside the frame with space around it. Static camera, plain flat solid magenta background, soft studio lighting, smooth animated-film style, sharp detail.

   Result: `public/nib/src/hop_raw.mp4`.
3. **Transparent loop.** `scripts/key-sprite.py` keys out the magenta, removes the purple light it bounced onto the body, drops frames the video smeared with motion blur, picks the start and end frames that match best so it loops without a jump, and writes `public/nib/think.webp`.

What didn't work, for the record: a first prompt asking for "a few hops, glancing around, arms swinging" made Higgsy leave the frame, blur and change shape; shrinking Higgsy in the start frame and asking for calm motion fixed it. A side-view walk cycle (Qwen-Image-Edit for the profile, LTX for the walk) worked technically but looked odd in the page, so it was dropped.

In the page (`src/components/Higgsy.tsx`) the clip is placed so its resting pose lines up with the front-view image to within a pixel, and the two crossfade.
