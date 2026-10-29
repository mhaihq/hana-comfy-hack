// Records a real call against the deployed site in headless Chromium, for the demo video.
//  - the microphone is replaced by a virtual one; the caller's questions (demo/out/caller/q*.wav, synthesized
//    speech) are played into it one at a time, each after Higgsy has finished answering
//  - Higgsy's voice is captured inside the page (a tee on the audio output), the screen with Playwright's recorder
//  - a red flash at the start lets the video and audio timelines be lined up afterwards
// Output: demo/out/rec/{video/*.webm, agent.webm, log.json}
//   NODE_PATH=$(npm root -g) node demo/record-call.js          (URL=... to record another deployment)
const { chromium } = require("playwright");
const fs = require("fs");

const OUT = "demo/out/rec";
const URL = process.env.URL || "https://hana-comfy-hack.vercel.app";
const QUESTIONS = (process.env.QS || "q1,q2,q3,q4").split(",");
fs.mkdirSync(OUT, { recursive: true });

const init = () => {
  const micCtx = new AudioContext({ sampleRate: 48000 });
  // a fresh virtual microphone per request (the SDK may stop the stream it gets for a permission probe)
  const dests = [];
  const silent = micCtx.createConstantSource(); silent.offset.value = 0; silent.start();
  const newMic = () => { const d = micCtx.createMediaStreamDestination(); silent.connect(d); dests.push(d); return d.stream; };
  const origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => {
    if (c && c.audio) { try { await micCtx.resume(); } catch (e) {} return newMic(); }
    return origGUM(c);
  };
  window.__say = async (b64) => {
    await micCtx.resume();
    const buf = await micCtx.decodeAudioData(Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)).buffer);
    const src = micCtx.createBufferSource(); src.buffer = buf;
    for (const d of dests) src.connect(d);
    src.start();
    return { epoch: Date.now(), dur: buf.duration, mics: dests.length };
  };
  // The SDK plays Higgsy through  worklet -> gain -> analyser -> MediaStreamDestination -> hidden <audio>.
  // Tee that stream (the analyser feeding a MediaStreamDestination) into a recorder and a level meter.
  const origConnect = AudioNode.prototype.connect;
  let tee = null;
  window.__gum = [];
  AudioNode.prototype.connect = function (dest, ...rest) {
    const r = origConnect.call(this, dest, ...rest);
    try {
      if (!tee && this instanceof AnalyserNode && dest instanceof MediaStreamAudioDestinationNode && this.context !== micCtx) {
        const an = this.context.createAnalyser(); an.fftSize = 1024;
        origConnect.call(this, an);
        const rec = new MediaRecorder(dest.stream, { mimeType: "audio/webm;codecs=opus" });
        tee = { ctx: this.context, an, rec, chunks: [], start: Date.now() };
        rec.ondataavailable = (e) => e.data.size && tee.chunks.push(e.data);
        rec.start(250);
      }
    } catch (e) { window.__gum.push("tee-error " + e); }
    return r;
  };
  const gum2 = navigator.mediaDevices.getUserMedia;
  navigator.mediaDevices.getUserMedia = async (c) => { window.__gum.push(JSON.stringify(c)); return gum2(c); };
  window.__micState = () => micCtx.state;
  window.__agentLevel = () => {
    if (!tee) return 0;
    const a = new Float32Array(tee.an.fftSize); tee.an.getFloatTimeDomainData(a);
    let s = 0; for (const v of a) s += v * v; return Math.sqrt(s / a.length);
  };
  window.__recStart = () => (tee ? tee.start : null);
  window.__recStop = () => new Promise((res) => {
    if (!tee) return res(null);
    tee.rec.onstop = async () => {
      const blob = new Blob(tee.chunks, { type: "audio/webm" });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      res(btoa(bin));
    };
    tee.rec.stop();
  });
};

(async () => {
  const log = { url: URL, events: [], captions: [] };
  const ev = (name, extra = {}) => { log.events.push({ t: Date.now(), ev: name, ...extra }); console.log(new Date().toISOString().slice(11, 23), name, JSON.stringify(extra)); };
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream"] });
  // a real 1920x1080 window, recorded at its native size (Playwright pads a smaller page onto a gray canvas)
  // the page is laid out as a 1280x720 window (the overrides below stand in for its vh units) and scaled 1.5x, so text and Higgsy are a good size
  // in the video and stay crisp (the browser re-rasterises a scaled body at the final size)
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: `${OUT}/video`, size: { width: 1920, height: 1080 } }, permissions: ["microphone"] });
  const page = await context.newPage();
  await page.addInitScript(init);
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const st = document.createElement("style");
      st.textContent = "html,body{width:1280px;height:720px;overflow:hidden} body{transform:scale(1.5);transform-origin:0 0} .call{height:720px!important} .nib-mover{width:min(331px,80vw)!important} .stage{padding-top:58px!important} .panel figure img{max-height:345px!important}";
      document.head.appendChild(st);
    });
  });
  page.on("console", (m) => { const t = m.text(); if (/error|warn|fail|mic|audio/i.test(t)) ev("console", { t: t.slice(0, 160) }); });
  page.on("pageerror", (e) => ev("pageerror", { msg: String(e).slice(0, 200) }));

  const waitTurn = async (maxMs = 80000) => {
    const t0 = Date.now(); let spoke = false, lastActive = 0;
    while (Date.now() - t0 < maxMs) {
      const s = await page.evaluate(() => ({ lvl: window.__agentLevel ? window.__agentLevel() : 0, think: !!document.querySelector(".thought"), load: !!document.querySelector(".demo-loading") }));
      const now = Date.now();
      if (s.lvl > 0.008) { spoke = true; lastActive = now; }
      if (spoke && !s.think && !s.load && now - lastActive > 2500) return { spoke, endedAt: lastActive };
      await page.waitForTimeout(100);
    }
    return { spoke, timeout: true };
  };
  const caption = async (label) => { const c = await page.evaluate(() => document.querySelector(".caption")?.textContent || ""); log.captions.push({ label, text: c }); ev("caption", { label, text: c.slice(0, 160) }); };

  try {
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    log.flashEpoch = await page.evaluate(async () => { const e = Date.now(); document.documentElement.style.background = "#ff0000"; document.body.style.background = "#ff0000"; await new Promise((r) => setTimeout(r, 400)); document.documentElement.style.background = ""; document.body.style.background = ""; return e; });
    ev("flash", { epoch: log.flashEpoch });
    await page.waitForTimeout(2500); // the home screen, with Higgsy waving
    ev("click-call"); await page.getByRole("button", { name: /call higgsy/i }).click();
    await page.waitForFunction(() => document.querySelector(".status")?.textContent?.includes("Live"), null, { timeout: 40000 });
    ev("live"); ev("probe", await page.evaluate(() => ({ gum: window.__gum, mic: window.__micState() })));
    const greet = await waitTurn(30000); ev("greeting-done", greet); await caption("greeting");

    const NOT_HEARD = /still there|you might be away|didn'?t (quite )?catch|couldn'?t hear|are you there/i;
    for (const q of QUESTIONS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        await page.waitForTimeout(700);
        const b64 = fs.readFileSync(`demo/out/caller/${q}.wav`).toString("base64");
        const said = await page.evaluate((b) => window.__say(b), b64);
        ev("question", { q, attempt, dur: said.dur, epoch: said.epoch, mic: await page.evaluate(() => window.__micState()) });
        await page.waitForTimeout(Math.round(said.dur * 1000) + 300);
        const t = await waitTurn(q === "q4" ? 40000 : 80000); ev("answer-done", { q, attempt, ...t }); await caption(q);
        const heard = !NOT_HEARD.test(log.captions[log.captions.length - 1].text) && (q !== "q4" || (await page.$(".panel figure img")));
        if (heard) break;
        ev("retry", { q, why: "the agent did not hear it, or no image appeared" });
      }
      if (q === "q4") { await page.waitForSelector(".panel figure img", { timeout: 60000 }).catch(() => ev("no-image")); ev("image-visible"); await page.waitForTimeout(5000); }
    }
    log.recStart = await page.evaluate(() => window.__recStart());
    await page.screenshot({ path: `${OUT}/end.png` });
    ev("hang-up"); await page.getByRole("button", { name: /end call/i }).click().catch(() => {});
    await page.waitForTimeout(1500);
    const b64 = await page.evaluate(() => window.__recStop());
    if (b64) fs.writeFileSync(`${OUT}/agent.webm`, Buffer.from(b64, "base64"));
    ev("audio-saved", { bytes: b64 ? b64.length : 0 });
  } catch (e) {
    ev("ERROR", { msg: String(e).slice(0, 300) });
    await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
    try { const b64 = await page.evaluate(() => window.__recStop()); if (b64) fs.writeFileSync(`${OUT}/agent.webm`, Buffer.from(b64, "base64")); } catch (e2) {}
  }
  fs.writeFileSync(`${OUT}/log.json`, JSON.stringify(log, null, 2));
  await context.close(); await browser.close();
  console.log("done");
})();
