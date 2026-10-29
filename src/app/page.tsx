"use client";

import { useState } from "react";
import { Call } from "@/components/Call";

export default function Home() {
  const [inCall, setInCall] = useState(false);
  if (inCall) return <Call onEnd={() => setInCall(false)} />;
  return (
    <main className="home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="home-nib" src="/nib/nib.png" alt="Higgsy" draggable={false} />
      <h1>Ask Higgsy</h1>
      <p className="lede">A voice call with a small guide who knows Higgsfield&apos;s models. Tell Higgsy what you want to make and get a straight recommendation.</p>
      <button className="call-btn" onClick={() => setInCall(true)}>Call Higgsy</button>
      <ul className="rules">
        <li>Prices and credits come only from Higgsfield&apos;s own pages, dated. If Higgsy doesn&apos;t know, Higgsy says so.</li>
        <li>Unofficial community project. Not affiliated with Higgsfield. Character and demos made with ComfyUI.</li>
        <li>Needs your microphone.</li>
      </ul>
    </main>
  );
}
