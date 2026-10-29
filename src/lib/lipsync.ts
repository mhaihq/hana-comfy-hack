// Lip sync from the agent's voice: every frame, the output spectrum becomes a mouth shape (viseme)
// for the Rive character, plus a 0-100 loudness for the jaw.
//
// Input is ElevenLabs' getOutputByteFrequencyData(): bytes (dB-scaled 0-255) laid out linearly from
// 100 Hz to 8 kHz. Mouth names follow Rhubarb Lip Sync, which the Rive file's mouths are drawn to:
//   X rest · A closed (M B P) · B teeth (S T K EE) · C open (EH AE) · D wide (AA)
//   E round (AO ER OH) · F pucker (OO W) · G F/V · H L
// Speech audio can't tell us phonemes exactly, so this reads the broad shape of the sound:
// loudness → how open, hiss → teeth, where the vowel energy sits → round vs open, and quick dips
// between syllables → lips closing. Each shape is held a few frames, like 2D animation.

export type Viseme = "X" | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

const HZ_MIN = 100;
const HZ_MAX = 8000;
const HOLD_MS = 62; // shortest time a mouth stays up (4 frames at 60 fps, like animating on fours)
const REST_AFTER_MS = 260; // silence longer than this is a pause (rest mouth), shorter is a closure

export type LipSyncFrame = { viseme: Viseme; open: number };

export class LipSync {
  private viseme: Viseme = "X";
  private since = 0;
  private lastVoice = -1e9;
  private peak = 0.2;
  private recent: { t: number; e: number }[] = [];
  private open = 0;

  update(bins: Uint8Array, now: number): LipSyncFrame {
    const band = (lo: number, hi: number) => {
      const n = bins.length;
      const a = Math.max(0, Math.floor(((lo - HZ_MIN) / (HZ_MAX - HZ_MIN)) * n));
      const b = Math.min(n, Math.ceil(((hi - HZ_MIN) / (HZ_MAX - HZ_MIN)) * n));
      let s = 0;
      for (let i = a; i < b; i++) s += bins[i];
      return b > a ? s / (b - a) / 255 : 0;
    };
    const energy = band(100, 4000);
    const f1 = band(250, 1000); // first formant region: jaw openness
    const f2 = band(1000, 2600); // second formant region: high for EE, low for OO
    const sib = band(4500, 8000); // hiss: S, SH, T, CH

    // loudness relative to this voice's recent peak, so quiet and loud agents both work
    this.peak = Math.max(this.peak * 0.997, energy, 0.12);
    const level = Math.min(1, energy / this.peak);

    this.recent.push({ t: now, e: level });
    while (this.recent.length && now - this.recent[0].t > 120) this.recent.shift();
    const recentMax = Math.max(...this.recent.map((r) => r.e));

    let next: Viseme;
    if (level < 0.32) {
      next = now - this.lastVoice > REST_AFTER_MS ? "X" : "A";
    } else {
      this.lastVoice = now;
      const dip = level < recentMax * 0.62 && level < 0.55; // a syllable boundary
      const ratio = f2 / (f1 + 0.02);
      if (dip) next = "A";
      else if (sib > 0.34 && sib > f1 * 0.85) next = "B";
      else if (level > 0.88 && ratio < 0.9) next = "D";
      else if (ratio < 0.62) next = level > 0.6 ? "E" : "F";
      else if (ratio > 1.05) next = level > 0.7 ? "C" : "B";
      else next = level > 0.55 ? "C" : "H";
    }

    // hold each mouth a few frames; a closure may cut in sooner so consonants stay crisp
    const held = now - this.since;
    if (next !== this.viseme && (held >= HOLD_MS || (next === "A" && held >= HOLD_MS * 0.75))) {
      this.viseme = next;
      this.since = now;
    }

    // jaw: fast open, slower close
    const target = this.viseme === "X" || this.viseme === "A" ? 0 : level * 100;
    this.open += (target - this.open) * (target > this.open ? 0.6 : 0.3);
    return { viseme: this.viseme, open: this.open };
  }
}
