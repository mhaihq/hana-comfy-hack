# Ask Higgsy

Video-call a small animated guide who helps you pick the right [Higgsfield](https://higgsfield.ai) model for what you want to make.

Made for the Comfy "Open Source Higgsfield" build night. **Unofficial community project. Not affiliated with Higgsfield.**

- **Voice call** with an animated character (ElevenLabs voice agent, lip sync from the speech timings).
- **Ask it anything about Higgsfield.** A `lookup` tool searches an index of Higgsfield's own public pages (help center, blog, product pages), so Higgsy can explain Soul ID, cancelling, credits, who owns your generations, the API and more, and name the page it used.
- **It never invents prices.** Higgsy only knows what's written in [`knowledge/`](knowledge): plan prices from Higgsfield's own pricing page and the official model catalog, each file dated and sourced. Anything else gets "I don't have that, check the pricing page", with the official page on screen.
- **Built with ComfyUI.** The character was generated with Z-Image-Turbo (open weights) on Comfy Cloud. During a call, Higgsy can run a real ComfyUI workflow and show you what a prompt looks like.

## How ComfyUI is used

| What | Workflow | Where it runs |
| --- | --- | --- |
| Higgsy's art | [`workflows/nib-character.api.json`](workflows/nib-character.api.json) (Z-Image-Turbo) | Comfy Cloud |
| Transparent cutout of Higgsy | Stock template `utility_birefnet_remove_background` (BiRefNet, open source), run on `public/nib/nib.png` | Comfy Cloud |
| Intro clip on the home screen | [`workflows/intro-video.ltx2_3_i2v.md`](workflows/intro-video.ltx2_3_i2v.md) (LTX-2.3 image to video, stock template) | Comfy Cloud |
| Live demo image during a call | [`workflows/demo-image.api.json`](workflows/demo-image.api.json) (same model, 768px) | Comfy Cloud, or your own ComfyUI via `COMFY_URL` |

Models for a local ComfyUI: `z_image_turbo_bf16.safetensors` (diffusion models), `qwen_3_4b.safetensors` (text encoders), `ae.safetensors` (VAE). Or open the `image_z_image_turbo` template in ComfyUI.

While Higgsy is quietly thinking or idle she does a little squash-and-stretch hop. That one is plain CSS on the front-view picture (not generated), and she stays still while she or the caller is speaking. Each demo image in the call has a "Made with this ComfyUI workflow" link to its workflow file, and the home screen clip links to its recipe.

The mouth shapes, eyelids and brows are drawn over the generated image in SVG ([`src/components/Higgsy.tsx`](src/components/Higgsy.tsx)). The mouth on the original render was painted out so the overlay can move it.

## Run it

**Requirements:** Node 20+, an [ElevenLabs](https://elevenlabs.io) account for the voice agent, and a place to deploy the site (Vercel works). The deploy matters because the voice agent runs in ElevenLabs' cloud and its `lookup` tool calls your site's `/api/lookup`, so that URL has to be public. For the live demo images you also need a Comfy Cloud API key (a paid plan) or your own local ComfyUI.

### Look at the character first (no keys)

```bash
npm install
npm run dev        # http://localhost:3000
```

The home screen works. `/preview?viseme=D&open=80&react=smile` shows the character without a microphone, and `/preview?thinking=1` shows her thinking hop. The call itself needs the keys below.

### Full setup

1. **Keys.** `cp .env.example .env.local` and set `ELEVENLABS_API_KEY`, plus `COMFY_API_KEY` (Comfy Cloud) or `COMFY_URL` (your own ComfyUI, e.g. `http://127.0.0.1:8188`).
2. **Deploy the site.** Import the repo into Vercel and set `ELEVENLABS_API_KEY` and `COMFY_API_KEY` (or `COMFY_URL`) as environment variables. The build runs `scripts/build-index.mjs`, which crawls Higgsfield's public pages for about 2 minutes. The call won't connect yet; it needs the agent id from the next step.
3. **Create the voice agent.** Put your site's address in `.env.local` as `PUBLIC_URL=https://your-site.vercel.app`, then run `npm run agent:deploy`. It creates the agent in your ElevenLabs account and saves `ELEVENLABS_AGENT_ID` into `.env.local`.
4. **Connect them.** Add `ELEVENLABS_AGENT_ID` to the Vercel environment variables and redeploy. Open the site, press **Call Higgsy**, and allow the microphone.
5. **Check it** with `npm run agent:test` (needs `PUBLIC_URL`).

Notes:
- The default voice is "Emma" from ElevenLabs' voice library. Add it to your account first, or set `HIGGSY_VOICE_ID` to any voice you like.
- ElevenLabs' free tier has a small monthly allowance and some restrictions on library voices; a paid plan removes them.
- Without `PUBLIC_URL` the agent still works, but has no lookup tool and answers only from `knowledge/`.
- To run the call locally, expose `npm run dev` through a tunnel (ngrok, cloudflared) and use that address as `PUBLIC_URL`. Run `npm run index` once first so `/api/lookup` has something to search.

## The "never invent" test

```bash
npm run agent:test
```

Asks Higgsy trap questions through ElevenLabs' conversation simulator: a plan that doesn't exist, an unlisted credit cost, an unannounced model, a discount code, a figure that should be answered (and calculated) from the notes, and general questions (cancelling, who owns your generations) that must come from Higgsfield's pages. All 11 pass at the time of writing (the general questions use the real lookup results as the tool output, since the simulator does not run webhooks).

## How "ask anything" stays honest

`npm run build` runs `scripts/build-index.mjs` first. It reads Higgsfield's sitemaps (English pages only, honouring their `robots.txt`, 4 requests at a time, identifying itself) and turns about 500 pages into 6,000 searchable passages in `data/index.json`. That file is **not committed**: it's rebuilt on every build, so a redeploy refreshes it. `/api/lookup` ranks passages with BM25 and returns them with their source URL and date. Higgsy's prompt only lets it state facts from `knowledge/` or from those results, and to say "I couldn't find that" otherwise. If the crawl fails, the build continues with just the notes in `knowledge/`.

Set `PUBLIC_URL` to your deployed site before `npm run agent:deploy`, so the agent's lookup tool calls your own `/api/lookup`.

## Keeping the knowledge current

Prices change. Update the files in `knowledge/` (keep the source URL and date at the top), then `npm run agent:deploy` again. The agent's prompt is the persona plus these files, nothing else.

## Demo video

`demo/` has the scripts that built the demo video: they record a real call against the deployed site, cut it, and join it with narrated clips. See [`demo/SCRIPT.md`](demo/SCRIPT.md).

## Known limits

- The in-call demo follows Comfy's documented v1 Cloud API (`/api/prompt`, `/api/job/{id}/status`, `/api/view`) and was tested end to end against Comfy Cloud on 2026-10-29 (768px image returned). The history lookup isn't documented, so the code tries two routes; v1 is marked deprecated by Comfy, so re-check if it stops working.
- ElevenLabs' free tier has a small monthly character allowance; long calls will use it up.
- The model catalog is a snapshot from 2026-10-29. If a model isn't in it, Higgsy says so.

## Credits and licence

Code: MIT ([LICENSE](LICENSE)). The character is original, generated for this project. Demo narration and voices are ElevenLabs.
