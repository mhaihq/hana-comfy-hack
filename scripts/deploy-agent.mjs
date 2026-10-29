// Creates (or updates, with ELEVENLABS_AGENT_ID set) the Higgsy voice agent in your ElevenLabs account.
// The agent's prompt = persona/system-prompt.md + every file in knowledge/, so it can only say what's written there.
// Needs PUBLIC_URL (your deployed site) for the lookup tool. Usage: node --env-file=.env.local scripts/deploy-agent.mjs
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";

const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error("Set ELEVENLABS_API_KEY in .env.local");
const api = "https://api.elevenlabs.io/v1/convai";
const headers = { "xi-api-key": key, "content-type": "application/json" };

const knowledge = readdirSync("knowledge")
  .filter((f) => f.endsWith(".md"))
  .sort()
  .map((f) => `\n## ${f}\n${readFileSync(`knowledge/${f}`, "utf8")}`)
  .join("\n");
const noLookup = process.env.PUBLIC_URL
  ? ""
  : "\n\n# Note on the lookup tool\nThe lookup tool is NOT available in this deployment. Ignore the instructions about it above: answer only from the KNOWLEDGE below, and say you don't know otherwise.\n";
const prompt = readFileSync("persona/system-prompt.md", "utf8") + noLookup + knowledge;
const first = readFileSync("persona/first-message.md", "utf8").trim();

const clientTool = (name, description, properties, required) => ({
  type: "client",
  name,
  description,
  expects_response: false,
  parameters: { type: "object", properties, required },
});
// Server tool: Higgsy searches the index behind /api/lookup on your deployed site (see scripts/build-index.mjs).
const publicUrl = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const lookupTool = {
  type: "webhook",
  name: "lookup",
  description: "Search Higgsfield's own public pages (help center, blog, product pages) for passages that answer a question about Higgsfield. Returns passages with their source and date. Say a short filler line like 'Hmm, let me check' before calling.",
  api_schema: {
    url: `${publicUrl}/api/lookup`,
    method: "GET",
    query_params_schema: {
      properties: { q: { type: "string", description: "A short search query in plain words, like 'cancel subscription' or 'Soul ID how many photos'" } },
      required: ["q"],
    },
  },
  response_timeout_secs: 10,
};
if (!publicUrl) console.warn("PUBLIC_URL is not set, so the agent gets no lookup tool and answers only from knowledge/. Deploy the site first, then set PUBLIC_URL (see README).");
const tools = [
  ...(publicUrl ? [lookupTool] : []),
  clientTool("react", "Trigger a facial reaction on the animated character. Call silently, about once per turn. Never mention it.", {
    name: { type: "string", enum: ["nod", "smile", "browRaise", "shake", "celebrate"], description: "The reaction" },
  }, ["name"]),
  clientTool("show_links", "Show an official Higgsfield page on the caller's screen.", {
    topic: { type: "string", enum: ["pricing", "docs"], description: "Which page to show" },
  }, ["topic"]),
  clientTool("note", "Pin a short note (eight words or fewer) when a recommendation is settled.", {
    text: { type: "string", description: "Eight words or fewer" },
  }, ["text"]),
  clientTool("demo", "Run a real ComfyUI image generation and show it on screen. Only when the caller asks to see an example.", {
    prompt: { type: "string", description: "Short image prompt the caller agreed to" },
  }, ["prompt"]),
];

const body = {
  name: "Higgsy - Higgsfield guide",
  conversation_config: {
    agent: {
      first_message: first,
      language: "en",
      prompt: { prompt, llm: process.env.HIGGSY_LLM || "gemini-2.5-flash", temperature: 0.2, tools },
    },
    tts: { voice_id: process.env.HIGGSY_VOICE_ID || "pPdl9cQBQq4p6mRkZy2Z" /* Emma - Adorable and Upbeat (ElevenLabs voice library; add it to your account first) */, model_id: "eleven_flash_v2" },
    conversation: { max_duration_seconds: 240 },
  },
  platform_settings: { auth: { enable_auth: true } },
};

const id = process.env.ELEVENLABS_AGENT_ID;
const res = await fetch(id ? `${api}/agents/${id}` : `${api}/agents/create`, {
  method: id ? "PATCH" : "POST",
  headers,
  body: JSON.stringify(body),
});
const json = await res.json();
if (!res.ok) {
  console.error(res.status, JSON.stringify(json, null, 2).slice(0, 2000));
  process.exit(1);
}
const agentId = id || json.agent_id;
console.log(id ? "Updated agent" : "Created agent", agentId);
if (!id && existsSync(".env.local")) {
  const env = readFileSync(".env.local", "utf8");
  if (!env.includes("ELEVENLABS_AGENT_ID")) writeFileSync(".env.local", env.trimEnd() + `\nELEVENLABS_AGENT_ID=${agentId}\n`);
}
