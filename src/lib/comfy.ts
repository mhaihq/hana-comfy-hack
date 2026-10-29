// Runs the demo workflow on ComfyUI: Comfy Cloud by default, or your own local ComfyUI via COMFY_URL.
// Cloud: https://docs.comfy.org/development/cloud/api-reference (X-API-Key header).
// Local ComfyUI serves the same /api/* routes, so one code path covers both.
import workflow from "../../workflows/demo-image.api.json";

const CLOUD = "https://cloud.comfy.org";
const base = () => (process.env.COMFY_URL || CLOUD).replace(/\/$/, "");
const isCloud = () => base().includes("comfy.org");
const authHeaders = (): Record<string, string> => (process.env.COMFY_API_KEY ? { "X-API-Key": process.env.COMFY_API_KEY } : {});

export const comfyConfigured = () => !isCloud() || Boolean(process.env.COMFY_API_KEY);

type FileRef = { filename: string; subfolder: string; type: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function json(path: string, init?: RequestInit) {
  const res = await fetch(`${base()}${path}`, { ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) }, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function outputOf(id: string): Promise<FileRef | null> {
  // history routes differ by deployment; try the likely ones
  for (const path of isCloud() ? [`/api/history_v2/${id}`, `/api/history/${id}`] : [`/api/history/${id}`]) {
    const r = await json(path);
    if (!r.ok) continue;
    const entry = (r.body as Record<string, any>)[id] ?? r.body; // eslint-disable-line @typescript-eslint/no-explicit-any
    const outputs = entry?.outputs ?? {};
    for (const node of Object.values<any>(outputs)) { // eslint-disable-line @typescript-eslint/no-explicit-any
      const img = node?.images?.[0];
      if (img?.filename) return { filename: img.filename, subfolder: img.subfolder ?? "", type: img.type ?? "output" };
    }
  }
  return null;
}

async function download(f: FileRef): Promise<{ data: Buffer; mime: string }> {
  const qs = new URLSearchParams({ filename: f.filename, subfolder: f.subfolder, type: f.type });
  // Don't follow the redirect with our key attached: the signed storage URL carries its own auth.
  const first = await fetch(`${base()}/api/view?${qs}`, { headers: authHeaders(), redirect: "manual", cache: "no-store" });
  const res = first.status >= 300 && first.status < 400 && first.headers.get("location") ? await fetch(first.headers.get("location")!, { cache: "no-store" }) : first;
  if (!res.ok) throw new Error(`Couldn't download the image (${res.status})`);
  return { data: Buffer.from(await res.arrayBuffer()), mime: res.headers.get("content-type") ?? "image/png" };
}

export async function generateImage(prompt: string): Promise<string> {
  const graph = structuredClone(workflow) as Record<string, { inputs: Record<string, unknown> }>;
  graph["57:27"].inputs.text = prompt;
  graph["57:3"].inputs.seed = Math.floor(Math.random() * 2 ** 31);

  const sub = await json("/api/prompt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: graph }),
  });
  const id = (sub.body as { prompt_id?: string }).prompt_id;
  if (!sub.ok || !id) throw new Error(sub.status === 402 ? "Out of Comfy credits" : sub.status === 401 ? "Comfy key rejected" : `Comfy refused the job (${sub.status})`);

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await sleep(1200);
    if (isCloud()) {
      const s = await json(`/api/job/${id}/status`);
      const status = (s.body as { status?: string }).status;
      if (status && ["error", "non_retryable_error", "lost", "cancelled"].includes(status)) throw new Error("The generation failed");
      if (status !== "success") continue;
    }
    const file = await outputOf(id);
    if (file) {
      const { data, mime } = await download(file);
      return `data:${mime};base64,${data.toString("base64")}`;
    }
  }
  throw new Error("The generation timed out");
}
