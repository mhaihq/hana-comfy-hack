"use client";

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

export function Higgsy({ viseme, open, blink, reaction, listening, thinking = false, wander = false }: { viseme: Viseme; open: number; blink: number; reaction: Reaction; listening: boolean; thinking?: boolean; wander?: boolean }) {
  const brows = reaction === "browRaise" || reaction === "celebrate" || thinking;
  const mouthShape: Viseme = thinking && viseme === "X" ? "A" : viseme; // a flat "hmm" mouth while thinking
  return (
    <div className={`nib-mover ${thinking ? "pacing" : wander ? "wandering" : ""}`}>
      {thinking && (
        <div className="thought" aria-hidden>
          <span>hmm</span>
          <i /><i /><i />
        </div>
      )}
    <div className={`nib ${thinking ? "nib-thinking" : reaction ? `nib-${reaction}` : ""} ${listening ? "nib-listening" : ""}`}>
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
  );
}
