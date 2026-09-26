import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const file = path.join(process.cwd(), ".env");
  if (!fs.existsSync(file)) return;

  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 1) continue;
    const key = trimmed.slice(0, i).trim();
    let value = trimmed.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const port = process.env.PORT || "3000";
const secret = process.env.GENERATION_WORKER_SECRET || process.env.JWT_SECRET;

if (!secret) {
  console.error("[JD Resume AI worker] worker secret is missing (set JWT_SECRET or GENERATION_WORKER_SECRET)");
  process.exit(1);
}

const url = `http://127.0.0.1:${port}/api/jobs/process`;

async function tick() {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-generation-worker-secret": secret,
      },
    });

    const text = await response.text();
    if (text && !text.includes('"processed":false')) {
      console.log("[JD Resume AI worker]", response.status, text.slice(0, 500));
    }
  } catch (error) {
    console.error("[JD Resume AI worker] request failed", error?.message || error);
  }
}

console.log("[JD Resume AI worker] started; polling", url);

while (true) {
  await tick();
  await new Promise((resolve) => setTimeout(resolve, 3000));
}
