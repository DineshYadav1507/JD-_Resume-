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
  );

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    company: { type: "string" },
    location: { type: "string" },
    seniority: { type: "string" },
    keywords: { type: "array", items: { type: "string" } },
    atsSkills: { type: "array", items: { type: "string" } },
    responsibilities: { type: "array", items: { type: "string" } },
    missingSkills: { type: "array", items: { type: "string" } },
  },
  required: [
    "title",
    "company",
    "location",
    "seniority",
    "keywords",
    "atsSkills",
    "responsibilities",
    "missingSkills",
  ],
};

const outputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
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
          bullets: { type: "array", items: { type: "string" } },
        },
        required: ["company", "title", "location", "startDate", "endDate", "current", "dates", "bullets"],
      },
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          technologies: { type: "array", items: { type: "string" } },
        },
        required: ["name", "description", "technologies"],
      },
    },
    certifications: { type: "array", items: { type: "string" } },
    education: { type: "array", items: { type: "string" } },
    coverLetter: { type: "string" },
  },
  required: ["summary", "skills", "experience", "projects", "certifications", "education", "coverLetter"],
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

  async function structured(messages: any[], schema: any) {
    const base = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");

    const res = await fetch(base + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        format: schema,
        options: { temperature: 0.2, num_ctx: 8192 },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Ollama request failed (${res.status})${body ? `: ${body.slice(0, 500)}` : ""}`);
    }

    const data: any = await res.json();
    const content = data.message?.content;
    if (!content) throw new Error("Ollama returned an empty response.");

    try {
      return JSON.parse(content);
    } catch {
      throw new Error("Ollama returned invalid JSON for the requested schema.");
    }
  }

  const a = await structured(
    [
      {
        role: "system",
        content:
          "Analyze the job description. Extract the job title, company, location, seniority, ATS keywords, skills, responsibilities, and unsupported/missing requirements. Return concise structured data. Do not invent candidate facts.",
      },
      {
        role: "user",
        content: "MASTER PROFILE:\n" + profileText(profile) + "\n\nJOB DESCRIPTION:\n" + jd,
      },
    ],
    analysisSchema,
  );

  let research: any = { source: "disabled", results: [] };
  try {
    research = await researchJobs(
      [a.title, a.company, ...(a.atsSkills || []).slice(0, 5)].filter(Boolean).join(" "),
      a.location || profile.location,
    );
  } catch {
    research = { source: "unavailable", results: [] };
  }

  const researchText = JSON.stringify(research.results || []).slice(0, 8000);

  const tailored = await structured(
    [
      {
        role: "system",
        content:
          "Create a highly JD-tailored ATS-friendly US resume and hiring-manager cover letter. Reorder and rewrite supported experience aggressively. Use the job description's terminology where it truthfully maps to the master profile. Preserve candidate facts: never invent employers, dates, degrees, certifications, projects, metrics, technologies, responsibilities, achievements, or years of experience. If a JD requirement is unsupported, do not present it as candidate experience. Return concise, complete data.",
      },
      {
        role: "user",
        content:
          "MASTER PROFILE:\n" +
          profileText(profile) +
          "\n\nJOB ANALYSIS:\n" +
          JSON.stringify(a) +
          "\n\nONLINE RESEARCH:\n" +
          researchText +
          "\n\nORIGINAL JOB DESCRIPTION:\n" +
          jd,
      },
    ],
    outputSchema,
  );

  return { analysis: a, research, ...normalizeOutput(tailored, profile) };
}
