"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Higgsy, type Reaction } from "@/components/Higgsy";
import type { Viseme } from "@/lib/lipsync";

// A mic-free look at the character: /preview?viseme=D&open=80&react=smile&blink=1
function View() {
  const q = useSearchParams();
  const viseme = (q.get("viseme") ?? "X") as Viseme;
  const react = (q.get("react") as Reaction) || null;
  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <Higgsy viseme={viseme} open={Number(q.get("open") ?? 60)} blink={Number(q.get("blink") ?? 0)} reaction={react} listening={false} />
    </main>
  );
}
export default function Preview() {
  return <Suspense><View /></Suspense>;
}
