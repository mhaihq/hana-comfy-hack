# Ask Higgsy

Video-call a small animated guide who helps you pick the right [Higgsfield](https://higgsfield.ai) model for what you want to make.

Made for the Comfy "Open Source Higgsfield" build night. **Unofficial community project. Not affiliated with Higgsfield.**

- **Voice call** with an animated character (ElevenLabs voice agent, lip sync from the speech timings).
- **It never invents prices.** Higgsy only knows what's written in [`knowledge/`](knowledge): plan prices from Higgsfield's own pricing page and the official model catalog, each file dated and sourced. Anything else gets "I don't have that, check the pricing page", with the official page on screen.
- **Built with ComfyUI.** The character was generated with Z-Image-Turbo (open weights) on Comfy Cloud. During a call, Higgsy can run a real ComfyUI workflow and show you what a prompt looks like.

## How ComfyUI is used

| What | Workflow | Where it runs |
| --- | --- | --- |
| Higgsy's art | [`workflows/nib-character.api.json`](workflows/nib-character.api.json) (Z-Image-Turbo) | Comfy Cloud |
| Live demo image during a call | [`workflows/demo-image.api.json`](workflows/demo-image.api.json) (same model, 768px) | Comfy Cloud, or your own ComfyUI via `COMFY_URL` |

Models for a local ComfyUI: `z_image_turbo_bf16.safetensors` (diffusion models), `qwen_3_4b.safetensors` (text encoders), `ae.safetensors` (VAE). Or open the `image_z_image_turbo` template in ComfyUI.

The mouth shapes, eyelids and brows are drawn over the generated image in SVG ([`src/components/Higgsy.tsx`](src/components/Higgsy.tsx)). The mouth on the original render was painted out so the overlay can move it.

## Run it

You need Node 20+, an [ElevenLabs](https://elevenlabs.io) key, and (for demos) a Comfy key or a local ComfyUI.

```bash
npm install
cp .env.example .env.local      # add ELEVENLABS_API_KEY (and COMFY_API_KEY or COMFY_URL)
npm run agent:deploy            # creates the voice agent in your ElevenLabs account, saves its id
npm run dev                     # http://localhost:3000
```

`/preview?viseme=D&open=80&react=smile` shows the character without a microphone.

## The "never invent" test

```bash
npm run agent:test
```

Asks Higgsy trap questions through ElevenLabs' conversation simulator: a plan that doesn't exist, an unlisted credit cost, an unannounced model, a discount code, and a figure that should be answered (and calculated) from the notes. All 7 pass at the time of writing.

## Keeping the knowledge current

Prices change. Update the files in `knowledge/` (keep the source URL and date at the top), then `npm run agent:deploy` again. The agent's prompt is the persona plus these files, nothing else.

## Known limits

- The in-call demo follows Comfy's documented v1 Cloud API (`/api/prompt`, `/api/job/{id}/status`, `/api/view`) and was tested end to end against Comfy Cloud on 2026-10-29 (768px image returned). The history lookup isn't documented, so the code tries two routes; v1 is marked deprecated by Comfy, so re-check if it stops working.
- ElevenLabs' free tier has a small monthly character allowance; long calls will use it up.
- The model catalog is a snapshot from 2026-10-29. If a model isn't in it, Higgsy says so.

## Credits and licence

Code: MIT ([LICENSE](LICENSE)). The lip sync and call loop are adapted from [Unstuck](https://github.com/srirammanogarux/unstuck) (MIT). The character is original, generated for this project.
