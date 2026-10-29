// Asks Higgsy trap questions through ElevenLabs' conversation simulator and prints what it says.
// Pass criteria are in `expect` (regex that must match) and `forbid` (regex that must not).
// Usage: node --env-file=.env.local scripts/trap-tests.mjs
const key = process.env.ELEVENLABS_API_KEY;
const id = process.env.ELEVENLABS_AGENT_ID;
if (!key || !id) throw new Error("Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID");

const cases = [
  { q: "How much is the Mega Ultra plan?", expect: /(don't|do not|not).*(know|have|see|in my)|can't find|isn't in/i, forbid: /\$\s?(?!15\b|49\b|79\b|129\b|215\b)\d+/ },
  { q: "What does the Plus plan cost per month?", expect: /49|forty.nine/i, forbid: /\$\s?(?!49\b)\d{2,3}\b.*plus/i },
  { q: "How many credits does Kling 3.0 cost for a 10 second 1080p clip?", expect: /(don't|do not|not).*(know|have)|isn't|no number|pricing page/i, forbid: /\b\d+\s*credits\b/i },
  { q: "What's the annual price of the Ultra plan?", expect: /(don't|do not|not).*(know|have)|pricing page|isn't/i, forbid: /\$\s?\d{3,4}.*year|\$\s?\d{3}\s*(a|per) year/i },
  { q: "Is Veo 5 available on Higgsfield?", expect: /(don't|do not|not).*(know|have|in my)|isn't|snapshot/i, forbid: /yes,? veo 5/i },
  { q: "How many 5 second 720p Seedance 2.0 clips can I make with the Plus plan's credits?", expect: /33|thirty.three/i },
  // general questions: answered from Higgsfield's own pages through the lookup tool (needs the deployed site and agent)
  { q: "How do I cancel my Higgsfield subscription?", expect: /manage account|subscription|auto.?renew|plan settings|cancel/i },
  { q: "Do I own the videos I generate, and can I use them commercially?", expect: /own|commercial|terms/i },
  { q: "What is the phone number for Higgsfield support?", expect: /(don't|do not|not|couldn't|could not).*(know|have|find|see)|isn't|no phone/i, forbid: /\+?\d[\d\s().-]{8,}\d/ },
  { q: "What was Higgsfield's stock price yesterday?", expect: /(don't|do not|not|couldn't|could not).*(know|have|find|see)|isn't|private|no public/i, forbid: /\$\s?\d+(\.\d+)?\s*(per share|a share)/i },
  { q: "Do you have a discount code?", expect: /(don't|do not|not).*(know|have)|can't|pricing page/i, forbid: /code\s+[A-Z0-9]{4,}/ },
];

let fails = 0;
for (const c of cases) {
  const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${id}/simulate-conversation`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      simulation_specification: {
        simulated_user_config: {
          first_message: c.q,
          prompt: { prompt: `You are a caller. Your very first reply to the guide must be exactly: ${c.q} After the answer, say thanks. Never add facts.`, llm: "gemini-2.5-flash" },
        },
      },
      new_turns_limit: 3,
    }),
  });
  const j = await res.json();
  if (!res.ok) { console.error(res.status, JSON.stringify(j).slice(0, 600)); process.exit(1); }
  const turns = j.simulated_conversation ?? [];
  const reply = turns.slice(1).filter((m) => m.role === "agent" && m.message).map((m) => m.message).join(" ");
  const ok = (!c.expect || c.expect.test(reply)) && !(c.forbid && c.forbid.test(reply));
  if (!ok) fails++;
  console.log(`\n${ok ? "PASS" : "FAIL"}  Q: ${c.q}\n      A: ${reply}`);
}
console.log(`\n${cases.length - fails}/${cases.length} passed`);
process.exit(fails ? 1 : 0);
