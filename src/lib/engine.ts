import { researchJobs } from "./search";

const profileText = (p: any) =>
  JSON.stringify(
    {
      name: p.user.name,
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
    title: { type: ["string", "null"] },
    company: { type: ["string", "null"] },
    location: { type: ["string", "null"] },
    seniority: { type: ["string", "null"] },
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
          dates: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
        },
        required: ["company", "title", "dates", "bullets"],
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
  required: [
    "summary",
    "skills",
    "experience",
    "projects",
    "certifications",
    "education",
    "coverLetter",
  ],
};

export async function tailor(profile: any, jd: string) {
  const model = process.env.OLLAMA_MODEL || "qwen2.5:3b";

  async function structured(messages: any[], schema: any) {
    const base = (
      process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"
    ).replace(/\/$/, "");

    const res = await fetch(base + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        format: schema,
        options: { temperature: 0.2 },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Ollama request failed (${res.status})${body ? `: ${body.slice(0, 500)}` : ""}`,
      );
    }

    const data: any = await res.json();
    const content = data.message?.content;

    if (!content) {
      throw new Error("Ollama returned an empty response.");
    }

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
          "Analyze the JD for ATS keywords, responsibilities and terminology. Aggressively identify what should shape the resume. Never invent immutable candidate facts.",
      },
      {
        role: "user",
        content:
          "MASTER PROFILE:\n" +
          profileText(profile) +
          "\n\nJOB DESCRIPTION:\n" +
          jd,
      },
    ],
    analysisSchema,
  );

  let research: any = { source: "disabled", results: [] };

  try {
    research = await researchJobs(
      [a.title, a.company, ...(a.atsSkills || []).slice(0, 5)]
        .filter(Boolean)
        .join(" "),
      a.location || profile.location,
    );
  } catch {}

  const tailored = await structured(
    [
      {
        role: "system",
        content:
          "Create a highly JD-tailored ATS-friendly US resume and cover letter. Rewrite and reorder supported experience aggressively, use JD terminology and transferable skills, emphasize relevant projects, and maximize legitimate keyword coverage. The master profile is the factual source of truth. Never fabricate employers, dates, degrees, certifications, projects, metrics, technologies, responsibilities, or achievements. Unsupported JD requirements must not be presented as candidate experience.",
      },
      {
        role: "user",
        content:
          "MASTER PROFILE:\n" +
          profileText(profile) +
          "\n\nJOB ANALYSIS:\n" +
          JSON.stringify(a) +
          "\n\nONLINE RESEARCH:\n" +
          JSON.stringify(research.results || []).slice(0, 12000) +
          "\n\nORIGINAL JD:\n" +
          jd,
      },
    ],
    outputSchema,
  );

  return { analysis: a, research, ...tailored };
}
