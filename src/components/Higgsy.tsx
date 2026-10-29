"use client";

import { useEffect, useRef, useState } from "react";
import type { Viseme } from "@/lib/lipsync";

export type Reaction = "nod" | "smile" | "browRaise" | "shake" | "celebrate" | null;

// The character is a ComfyUI render (public/nib/nib.png, mouth painted out). Everything that moves is
// drawn on top in SVG, in the image's own 1024 x 1024 space: mouth shapes, eyelids, brows.
const MOUTH_X = 521;
const MOUTH_Y = 597;
const INK = "#5a2b1e";
const FACE = "#f8da90";

function Mouth({ viseme, open, smile }: { viseme: Viseme; open: number; smile: boolean }) {
  const j = 0.75 + Math.min(1, open / 100) * 0.5; // jaw: loudness stretches the shape
  const inside = "#7a2630";
  const shape = (rx: number, ry: number, teeth = false) => (
    <g>
      <ellipse cx={MOUTH_X} cy={MOUTH_Y + ry * 0.2} rx={rx} ry={ry * j} fill={inside} stroke={INK} strokeWidth={5} />
      {teeth && <rect x={MOUTH_X - rx * 0.72} y={MOUTH_Y + ry * 0.2 - ry * j * 0.85} width={rx * 1.44} height={ry * j * 0.42} rx={5} fill="#fff8ea" />}
      <ellipse cx={MOUTH_X} cy={MOUTH_Y + ry * 0.2 + ry * j * 0.5} rx={rx * 0.5} ry={ry * j * 0.32} fill="#e8707a" />
    </g>
  );
  if (smile) return <path d={`M ${MOUTH_X - 44} ${MOUTH_Y - 6} Q ${MOUTH_X} ${MOUTH_Y + 38} ${MOUTH_X + 44} ${MOUTH_Y - 6} Z`} fill={inside} stroke={INK} strokeWidth={5} strokeLinejoin="round" />;
  switch (viseme) {
    case "A":
      return <path d={`M ${MOUTH_X - 28} ${MOUTH_Y} L ${MOUTH_X + 28} ${MOUTH_Y}`} stroke={INK} strokeWidth={7} strokeLinecap="round" />;
    case "B":
      return shape(30, 11, true);
    case "C":
      return shape(26, 17);
    case "D":
      return shape(30, 26);
    case "E":
      return shape(15, 19);
    case "F":
      return shape(10, 12);
    case "G":
      return shape(26, 8, true);
    case "H":
      return shape(22, 12);
    default:
      return <path d={`M ${MOUTH_X - 34} ${MOUTH_Y - 4} Q ${MOUTH_X} ${MOUTH_Y + 18} ${MOUTH_X + 34} ${MOUTH_Y - 4}`} stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />;
  }
}

// Strolling: when Higgsy is thinking (or idling), it moves into side view, walks a few steps left, turns,
// walks right, and so on. The side view is a walk cycle made in ComfyUI (public/nib/walk.webp, facing left;
// mirrored for walking right). A turn squashes the side view narrow, flips it and squashes it back out, the
// way a side-on character turns round. Going to and from the front view is a short crossfade.
// When it finishes, Higgsy walks back to the middle and faces front again.
type Stroll = { side: boolean; dir: "L" | "R"; squash: boolean; x: number; ms: number };
const LEG = 26; // how far one leg of the walk goes, as % of Higgsy's width
const MS_PER_PCT = 65; // walking speed
const SQUASH_MS = 130; // half of a turn

function useStroll(active: boolean) {
  const [s, setS] = useState<Stroll>({ side: false, dir: "L", squash: false, x: 0, ms: 0 });
  const ref = useRef<Stroll>(s);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let dead = false;
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(() => !dead && fn(), ms));
    const set = (patch: Partial<Stroll>) => {
      ref.current = { ...ref.current, ...patch };
      setS(ref.current);
    };
    // squash, flip while narrow, squash back out
    const turn = (to: "L" | "R", next: () => void) => {
      set({ squash: true, ms: 0 });
      at(SQUASH_MS, () => {
        set({ dir: to });
        at(30, () => {
          set({ squash: false });
          at(SQUASH_MS, next);
        });
      });
    };
    const walk = (to: number, next: () => void) => {
      const ms = Math.max(200, Math.abs(to - ref.current.x) * MS_PER_PCT);
      set({ side: true, squash: false, dir: to < ref.current.x ? "L" : "R", x: to, ms });
      at(ms, next);
    };
    if (active) {
      let target = -LEG;
      const leg = () =>
        walk(target, () => {
          target = target < 0 ? LEG : -LEG;
          turn(target < 0 ? "L" : "R", leg);
        });
      set({ side: true, dir: "L", squash: false, ms: 0 });
      at(220, leg); // let the crossfade to side view finish first
    } else if (ref.current.side) {
      const away = Math.abs(ref.current.x) > 1;
      const home = () => set({ side: false, squash: false, x: 0, ms: 0 });
      if (away) walk(0, () => at(60, home));
      else home();
    }
    return () => {
      dead = true;
      timers.forEach(clearTimeout);
    };
  }, [active]);
  return s;
}

export function Higgsy({ viseme, open, blink, reaction, listening, thinking = false, wander = false }: { viseme: Viseme; open: number; blink: number; reaction: Reaction; listening: boolean; thinking?: boolean; wander?: boolean }) {
  const brows = reaction === "browRaise" || reaction === "celebrate" || thinking;
  const mouthShape: Viseme = thinking && viseme === "X" ? "A" : viseme; // a flat "hmm" mouth while thinking
  const st = useStroll(thinking || wander);
  const walking = st.side && !st.squash;
  return (
    <div className="nib-mover">
      <div className="stroller" style={{ transform: `translateX(${st.x}%)`, transitionDuration: `${st.ms}ms` }}>
        {thinking && (
          <div className="thought" aria-hidden>
            <span>hmm</span>
            <i /><i /><i />
          </div>
        )}
        <div className={`walker-box ${st.side ? "walking" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={`walker ${st.side ? "on" : ""} ${st.dir === "R" ? "flip" : ""} ${st.squash ? "squash" : ""}`} src="/nib/walk.webp" alt="" aria-hidden draggable={false} />
        </div>
        <div className={`nib ${st.side ? "nib-hidden" : thinking ? "nib-thinking" : reaction ? `nib-${reaction}` : ""} ${listening ? "nib-listening" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/nib/higgsy.png" alt="Higgsy, a round teal ink-drop character" draggable={false} />
          <svg viewBox="0 0 1024 1024" aria-hidden>
            <defs>
              <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" /></filter>
            </defs>
            {/* eyelids: face-coloured, closing from the top */}
            {[380, 660].map((cx) => (
              <ellipse key={cx} cx={cx} cy={540 - 62 + blink * 62} rx={62} ry={Math.max(0.01, blink * 66)} fill={FACE} filter="url(#soft)" style={{ opacity: blink > 0.03 ? 1 : 0 }} />
            ))}
            {blink > 0.6 && [380, 660].map((cx) => <path key={cx} d={`M ${cx - 40} ${548} Q ${cx} ${568} ${cx + 40} ${548}`} stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />)}
            {brows && (
              <g stroke="#3b5f58" strokeWidth={9} strokeLinecap="round" fill="none">
                <path d={thinking ? "M 322 440 Q 380 404 438 430" : "M 322 452 Q 380 420 438 448"} />
                <path d={thinking ? "M 602 462 Q 660 452 718 468" : "M 602 448 Q 660 420 718 452"} />
              </g>
            )}
            <g transform={`translate(${MOUTH_X} ${MOUTH_Y}) scale(1.55) translate(${-MOUTH_X} ${-MOUTH_Y})`}>
              <Mouth viseme={mouthShape} open={open} smile={reaction === "smile" || reaction === "celebrate"} />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
