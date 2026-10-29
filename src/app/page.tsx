"use client";

import { useState } from "react";
import { Call } from "@/components/Call";

const REPO = "https://github.com/mhaihq/hana-comfy-hack";

export default function Home() {
  const [inCall, setInCall] = useState(false);
  if (inCall) return <Call onEnd={() => setInCall(false)} />;
  return (
    <main className="home">
      <div className="home-stage">
        {/* The greeting is an LTX-2.3 image-to-video clip made in ComfyUI; the still is for reduced motion */}
        <video className="home-nib home-video" src="/nib/intro.mp4" poster="/nib/intro-poster.jpg" autoPlay muted loop playsInline aria-label="Higgsy waves hello" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="home-nib home-still" src="/nib/nib.png" alt="Higgsy" draggable={false} />
        <p className="made-with">
          Made with ComfyUI: LTX-2.3 image to video · <a href={`${REPO}/blob/main/workflows/intro-video.ltx2_3_i2v.md`} target="_blank" rel="noreferrer">workflow</a>
        </p>
      </div>
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
