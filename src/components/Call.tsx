"use client";

import { useEffect, useRef, useState } from "react";
import { Conversation, stripAudioTags, type VoiceConversation } from "@elevenlabs/client";
import { LipSync, type Viseme } from "@/lib/lipsync";
import { charsToVisemes } from "@/lib/textVisemes";
import { Higgsy, type Reaction } from "./Higgsy";

type Line = { role: "user" | "agent"; text: string };
type Demo = { state: "loading" | "done" | "error"; prompt: string; image?: string; error?: string };

// Where the demo image's workflow lives in the repo, so anyone can open it in ComfyUI.
const WORKFLOW_URL = "https://github.com/mhaihq/hana-comfy-hack/blob/main/workflows/demo-image.api.json";

const REACTIONS = ["nod", "smile", "browRaise", "shake", "celebrate"] as const;
// The only pages the agent can show. Fixed here so it can never put a link of its own on screen.
const LINKS = {
  pricing: [
    { label: "Higgsfield pricing", url: "https://higgsfield.ai/pricing" },
    { label: "Pricing explained (Higgsfield blog)", url: "https://higgsfield.ai/blog/higgsfield-pricing-explained" },
  ],
  docs: [{ label: "Higgsfield", url: "https://higgsfield.ai" }],
} as const;

export function Call({ onEnd }: { onEnd: () => void }) {
  const [phase, setPhase] = useState<"connecting" | "live" | "ended">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [face, setFace] = useState<{ viseme: Viseme; open: number; blink: number }>({ viseme: "X", open: 0, blink: 0 });
  const [reaction, setReaction] = useState<Reaction>(null);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [wander, setWander] = useState(false);
  const [caption, setCaption] = useState<Line | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [links, setLinks] = useState<(typeof LINKS)[keyof typeof LINKS] | null>(null);
  const [demo, setDemo] = useState<Demo | null>(null);
  const conv = useRef<VoiceConversation | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    const lip = new LipSync();
    let track: { t: number; v: Viseme }[] = [];
    let trackEnd = 0;
    let mode: "speaking" | "listening" = "listening";
    let nextBlink = performance.now() + 2000;
    let blinkStart = 0;
    let last = { viseme: "X" as Viseme, open: 0, blink: 0 };
    let lastPaint = 0;
    let wasListening = false;
    // thinking: a lookup is running, or the caller finished and Higgsy hasn't started answering yet
    const pending = new Set<string>();
    let awaiting = false;
    let isThinking = false;
    const syncThinking = () => {
      const next = pending.size > 0 || awaiting;
      if (next !== isThinking) {
        isThinking = next;
        setThinking(next);
      }
    };
    let nextWander = performance.now() + 9000 + Math.random() * 5000;
    let wanderUntil = 0;

    const react = (name: string) => {
      if (!(REACTIONS as readonly string[]).includes(name)) return;
      clearTimeout(reactionTimer.current);
      setReaction(name as Reaction);
      reactionTimer.current = setTimeout(() => setReaction(null), name === "celebrate" ? 1800 : 900);
    };

    const runDemo = async (prompt: string) => {
      setDemo({ state: "loading", prompt });
      try {
        const res = await fetch("/api/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt }) });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "Demo failed");
        setDemo({ state: "done", prompt: j.prompt, image: j.image });
      } catch (e) {
        setDemo({ state: "error", prompt, error: e instanceof Error ? e.message : "Demo failed" });
      }
    };

    (async () => {
      try {
        const audioSession = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
        if (audioSession) audioSession.type = "play-and-record";
        const res = await fetch("/api/session", { cache: "no-store" });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Higgsy can't take calls right now");
        if (cancelled) return;
        const c = (await Conversation.startSession({
          signedUrl: body.signedUrl as string,
          connectionType: "websocket",
          clientTools: {
            react: ({ name }: { name: string }) => react(name),
            show_links: ({ topic }: { topic: string }) => {
              if (topic === "pricing" || topic === "docs") setLinks(LINKS[topic]);
            },
            note: ({ text }: { text: string }) => {
              const clean = String(text ?? "").trim().replace(/^["']|["']$/g, "").slice(0, 80);
              if (clean) setNotes((n) => (n.some((x) => x.toLowerCase() === clean.toLowerCase()) ? n : [...n, clean]));
            },
            demo: ({ prompt }: { prompt: string }) => {
              void runDemo(String(prompt ?? ""));
            },
          },
          onConnect: () => !cancelled && setPhase("live"),
          onAudioAlignmentPlayback: ({ alignment: a }) => {
            if (!a?.chars?.length) return;
            const now = performance.now();
            const keys = charsToVisemes(a.chars, a.char_start_times_ms, a.char_durations_ms);
            const end = a.chars.length - 1;
            track = track.filter((k) => k.t < now).concat(keys.map((k) => ({ t: now + k.t, v: k.v })));
            trackEnd = Math.max(trackEnd, now + a.char_start_times_ms[end] + a.char_durations_ms[end]);
          },
          onInterruption: () => {
            track = [];
            trackEnd = 0;
          },
          onModeChange: ({ mode: m }) => {
            mode = m;
            setSpeaking(m === "speaking");
            if (m === "speaking") {
              awaiting = false;
              syncThinking();
            }
          },
          onAgentToolRequest: (e) => {
            const t = e as unknown as { tool_name?: string; tool_call_id?: string };
            if (t.tool_name === "lookup") {
              pending.add(t.tool_call_id ?? "lookup");
              syncThinking();
            }
          },
          onAgentToolResponse: (e) => {
            const t = e as unknown as { tool_name?: string; tool_call_id?: string };
            if (t.tool_name === "lookup") {
              pending.delete(t.tool_call_id ?? "lookup");
              if (t.tool_call_id === undefined) pending.clear();
              syncThinking();
            }
          },
          onMessage: ({ role, message }) => {
            const text = role === "agent" ? stripAudioTags(message).trim() : message;
            if (text) setCaption({ role, text });
            if (role === "user") {
              awaiting = true;
              syncThinking();
            }
          },
          onDisconnect: () => !cancelled && setPhase("ended"),
          onError: (m) => setError(typeof m === "string" ? m : "The call dropped"),
        })) as VoiceConversation;
        if (cancelled) {
          void c.endSession();
          return;
        }
        conv.current = c;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't connect");
      }
    })();

    const tick = () => {
      const now = performance.now();
      const c = conv.current;
      let viseme: Viseme = "X";
      let open = 0;
      if (c && mode === "speaking") {
        const f = lip.update(c.getOutputByteFrequencyData(), now);
        viseme = f.viseme;
        open = f.open;
        if (now < trackEnd) {
          while (track.length > 1 && track[1].t <= now) track.shift();
          if (track.length && track[0].t <= now) viseme = track[0].v;
        }
      }
      // blink every 2.5-5 s, 140 ms long
      if (!blinkStart && now > nextBlink) blinkStart = now;
      let blink = 0;
      if (blinkStart) {
        const p = (now - blinkStart) / 140;
        blink = p >= 1 ? 0 : Math.sin(p * Math.PI);
        if (p >= 1) {
          blinkStart = 0;
          nextBlink = now + 2500 + Math.random() * 2500;
        }
      }
      // now and then, when nothing is going on, Higgsy takes a little walk
      if (now > nextWander) {
        nextWander = now + 12000 + Math.random() * 8000;
        if (!isThinking && mode !== "speaking" && !wasListening) {
          wanderUntil = now + 3600;
          setWander(true);
        }
      }
      if (wanderUntil && now > wanderUntil) {
        wanderUntil = 0;
        setWander(false);
      }
      const isListening = !!c && mode === "listening" && c.getInputVolume() > 0.06;
      if (isListening !== wasListening) {
        wasListening = isListening;
        setListening(isListening);
      }
      // repaint at ~30 fps and only when something changed
      if (now - lastPaint > 33 && (viseme !== last.viseme || Math.abs(open - last.open) > 3 || Math.abs(blink - last.blink) > 0.05)) {
        last = { viseme, open, blink };
        lastPaint = now;
        setFace(last);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(reactionTimer.current);
      void conv.current?.endSession();
      conv.current = null;
    };
  }, []);

  const hangUp = async () => {
    await conv.current?.endSession();
    setPhase("ended");
    onEnd();
  };
  const toggleMute = () => {
    conv.current?.setMicMuted(!muted);
    setMuted(!muted);
  };

  return (
    <div className="call">
      <div className="stage">
        <Higgsy viseme={face.viseme} open={face.open} blink={face.blink} reaction={reaction} listening={listening} thinking={thinking} wander={wander} still={speaking || listening} />
        <div className="status">{phase === "connecting" ? "Calling Higgsy…" : phase === "live" ? (muted ? "You're muted" : "Live") : "Call ended"}</div>
        {caption && <p className={`caption ${caption.role}`}>{caption.text}</p>}
        {error && <p className="error">{error}</p>}
      </div>

      <aside className="panel">
        {notes.length > 0 && (
          <section>
            <h2>Pinned</h2>
            <ul className="notes">{notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </section>
        )}
        {demo && (
          <section>
            <h2>Made live with ComfyUI</h2>
            {demo.state === "loading" && <div className="demo-loading">Generating “{demo.prompt}”…</div>}
            {demo.state === "error" && <div className="demo-error">{demo.error}</div>}
            {demo.state === "done" && demo.image && (
              <figure>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={demo.image} alt={demo.prompt} />
                <figcaption>
                  {demo.prompt}
                  <br />
                  <a href={WORKFLOW_URL} target="_blank" rel="noreferrer">Made with this ComfyUI workflow</a>
                  {" · Z-Image-Turbo"}
                </figcaption>
              </figure>
            )}
          </section>
        )}
        {links && (
          <section>
            <h2>Official pages</h2>
            <ul className="links">{links.map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer">{l.label}</a></li>)}</ul>
          </section>
        )}
        {!notes.length && !demo && !links && <p className="hint">Ask Higgsy which Higgsfield model fits what you want to make. Prices and credit costs only come from Higgsfield&apos;s own pages.</p>}
      </aside>

      <div className="controls">
        <button onClick={toggleMute} disabled={phase !== "live"} aria-pressed={muted}>{muted ? "Unmute" : "Mute"}</button>
        <button className="hangup" onClick={hangUp}>End call</button>
      </div>
    </div>
  );
}
