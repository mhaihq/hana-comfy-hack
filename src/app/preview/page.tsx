"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Higgsy, type Reaction } from "@/components/Higgsy";
import type { Viseme } from "@/lib/lipsync";

// A mic-free look at the character: /preview?viseme=D&open=80&react=smile&blink=1&thinking=1&wander=1&still=1
function View() {
  const q = useSearchParams();
  const viseme = (q.get("viseme") ?? "X") as Viseme;
  // ?stillAfter=1500 interrupts the hop after that many ms, to check how she lands
  const [still, setStill] = useState(q.get("still") === "1");
  const stillAfter = Number(q.get("stillAfter") ?? 0);
  useEffect(() => {
    if (!stillAfter) return;
    const t = setTimeout(() => setStill(true), stillAfter);
    return () => clearTimeout(t);
  }, [stillAfter]);
  const react = (q.get("react") as Reaction) || null;
  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <Higgsy viseme={viseme} open={Number(q.get("open") ?? 60)} blink={Number(q.get("blink") ?? 0)} reaction={react} listening={false} thinking={q.get("thinking") === "1"} wander={q.get("wander") === "1"} still={still} />
    </main>
  );
}
export default function Preview() {
  return <Suspense><View /></Suspense>;
}
