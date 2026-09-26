import { researchJobs } from "./search";

const profileText = (p: any) =>
  JSON.stringify(
    {
      name: p.user?.name || p.name,
      phone: p.phone,
      location: p.location,
      linkedin: p.linkedin,
      website: p.website,
      headline: p.headline,
      summary: p.summary,
      skills: p.skills,
      certifications: p.certifications,
      experiences: p.experiences,
      projects: p.projects,
      education: p.education,
    },
    null,
    2,
  ).slice(0, 14000);

const outputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    company: { type: "string" },
    location: { type: "string" },
    seniority: { type: "string" },
    keywords: { type: "array", items: { type: "string" } },
    atsSkills: { type: "array", items: { type: "string" } },
    missingSkills: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
    skills: { type: "array", items: { type: "string" } },
    experience: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          company: { type: "string" },
          title: { type: "string" },
          location: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          current: { type: "boolean" },
          dates: { type: "string" },
          bullets: { type: "array", items: { type: "string" } }
        },
        required: ["company","title","location","startDate","endDate","current","dates","bullets"]
      }
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          technologies: { type: "array", items: { type: "string" } }
        },
        required: ["name","description","technologies"]
      }
    },
    certifications: { type: "array", items: { type: "string" } },
    education: { type: "array", items: { type: "string" } },
    coverLetter: { type: "string" }
  },
  required: ["title","company","location","seniority","keywords","atsSkills","missingSkills","summary","skills","experience","projects","certifications","education","coverLetter"]
};

function cleanList(value: any, max = 60): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()))].slice(0, max);
}

function normalizeOutput(raw: any, profile: any) {
  const sourceExperiences = Array.isArray(profile.experiences) ? profile.experiences : [];
  const experience = Array.isArray(raw?.experience)
    ? raw.experience.map((x: any, i: number) => {
        const source =
          sourceExperiences.find(
            (s: any) =>
              String(s?.company || "").toLowerCase() === String(x?.company || "").toLowerCase() &&
              String(s?.title || "").toLowerCase() === String(x?.title || "").toLowerCase(),
          ) ||
          sourceExperiences[i] ||
          {};
        return {
          company: source.company || "",
          title: source.title || "",
          location: source.location || "",
          startDate: source.startDate || "",
          endDate: source.endDate || "",
          current: Boolean(source.current),
          dates: source.dates || "",
          bullets: cleanList(x?.bullets, 20),
        };
      })
    : sourceExperiences.map((x: any) => ({
        company: x.company || "",
        title: x.title || "",
        location: x.location || "",
        startDate: x.startDate || "",
        endDate: x.endDate || "",
        current: Boolean(x.current),
        dates: x.dates || "",
        bullets: cleanList(x.bullets, 20),
      }));

  return {
    summary: String(raw?.summary || profile.summary || "").trim(),
    skills: cleanList(raw?.skills, 100),
    experience,
    projects: Array.isArray(raw?.projects) ? raw.projects : [],
    certifications: cleanList(raw?.certifications, 50),
    education: cleanList(raw?.education, 20),
    coverLetter: String(raw?.coverLetter || "").trim(),
  };
}

export async function tailor(profile: any, jd: string) {
  const model = process.env.OLLAMA_MODEL || "qwen2.5:3b";
  const compactJd = jd.trim().slice(0, 12000);

  const base = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 300000);

  try {
    const res = await fetch(base + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are an expert US ATS resume writer. Produce one complete tailored resume and cover letter from the master profile and job description. Aggressively optimize wording, ordering, keyword alignment, and bullet phrasing, but NEVER invent employers, dates, degrees, certifications, projects, metrics, technologies, responsibilities, achievements, or years of experience. Employment company, title, location, start date, end date and current status MUST come from the master profile. Unsupported JD requirements belong in missingSkills. Keep output concise enough for a 2-page resume."
          },
          {
            role: "user",
            content:
              "MASTER PROFILE:\n" + profileText(profile) +
              "\n\nJOB DESCRIPTION:\n" + compactJd
          }
        ],
        stream: false,
        format: outputSchema,
        options: {
          temperature: 0.1,
          num_ctx: 4096,
          num_predict: 2200
        },
        keep_alive: "10m"
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error("Ollama request failed (" + res.status + ")" + (body ? ": " + body.slice(0, 500) : ""));
    }

    const data: any = await res.json();
    const content = data.message?.content;
    if (!content) throw new Error("Ollama returned an empty response.");

    let raw: any;
    try {
      raw = JSON.parse(content);
    } catch {
      throw new Error("Ollama returned invalid JSON.");
    }

    const analysis = {
      title: String(raw.title || ""),
      company: String(raw.company || ""),
      location: String(raw.location || ""),
      seniority: String(raw.seniority || ""),
      keywords: cleanList(raw.keywords, 40),
      atsSkills: cleanList(raw.atsSkills, 50),
      responsibilities: [],
      missingSkills: cleanList(raw.missingSkills, 50)
    };

    const normalized = normalizeOutput(raw, profile);

    return {
      analysis,
      research: { source: "disabled", results: [] },
      ...normalized
    };
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("AI generation timed out after 5 minutes. On this 1-core VPS the local model is too slow for this request.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
