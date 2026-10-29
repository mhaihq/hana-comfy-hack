# Higgsy intro clip (LTX-2.3 image to video)

Made on Comfy Cloud with the stock ComfyUI template **`video_ltx2_3_i2v`** (LTX-2.3, open weights, by Lightricks). Open that template in ComfyUI (Templates, search "LTX-2.3: Image to Video") and set these values to reproduce it.

- Input image: `public/nib/base.png` (the Z-Image-Turbo render from `nib-character.api.json`)
- Size: 768 x 768
- Length: 3 seconds (25 fps), generated audio is kept in `public/nib/higgsy-intro-ltx2.3.mp4`; the site plays `intro.mp4`, the same clip without sound
- Prompt:

> A cute round teal ink-drop creature with a yellow face waves one small arm hello and smiles warmly, blinking once, with a gentle happy bounce. Static camera, plain solid cream background, soft studio lighting, smooth animated-film style. Character stays centered and keeps the same design throughout.

Everything else is the template's default (checkpoint `ltx-2.3-22b-dev-fp8`, distilled LoRA, Gemma text encoder, x2 spatial upscaler, default negative prompt).

Through the Comfy Cloud MCP the overrides were node inputs on the template's subgraph: `269.image` (the image), `320:312.value` (width), `320:299.value` (height), `320:301.value` (length in seconds), `320:319.value` (prompt).
