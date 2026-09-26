function compactProfile(p: any) {
  const experiences = Array.isArray(p.experiences) ? p.experiences : [];
  const projects = Array.isArray(p.projects) ? p.projects : [];

  return JSON.stringify({
    name: p.user?.name || p.name || "",
    headline: p.headline || "",
    summary: p.summary || "",
    skills: Array.isArray(p.skills) ? p.skills.slice(0, 60) : [],
    experiences: experiences.map((x: any) => ({
      company: x.company || "",
      title: x.title || "",
      location: x.location || "",
      startDate: x.startDate || "",
      endDate: x.endDate || "",
      current: Boolean(x.current),
      bullets: Array.isArray(x.bullets) ? x.bullets.slice(0, 6) : [],
    })),
    projects: projects.slice(0, 8).map((x: any) => ({
      name: x.name || "",
      description: x.description || "",
      technologies: Array.isArray(x.technologies) ? x.technologies.slice(0, 12) : [],
    })),
    certifications: Array.isArray(p.certifications) ? p.certifications.slice(0, 20) : [],
    education: Array.isArray(p.education) ? p.education.slice(0, 10) : [],
  }, null, 2);
}

const outputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    company: { type: "string" },
    location: { type: "string" },
    seniority: { type: "string" },
    atsSkills: { type: "array", items: { type: "string" }, maxItems: 18 },
    missingSkills: { type: "array", items: { type: "string" }, maxItems: 12 },
    summary: { type: "string" },
    skills: { type: "array", items: { type: "string" }, maxItems: 24 },
    experienceBullets: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          bullets: { type: "array", items: { type: "string" }, maxItems: 5 },
        },
        required: ["bullets"],
      },
    },
    coverLetter: { type: "string" },
  },
  required: [
    "title",
    "company",
    "location",
    "seniority",
    "atsSkills",
    "missingSkills",
    "summary",
    "skills",
    "experienceBullets",
    "coverLetter",
  ],
};

function cleanList(value: any, max = 60): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter((x) => typeof x === "string" && x.trim())
      .map((x) => x.trim()),
  )].slice(0, max);
}

function normalizeOutput(raw: any, profile: any) {
  const sourceExperiences = Array.isArray(profile.experiences) ? profile.experiences : [];
  const generated = Array.isArray(raw?.experienceBullets) ? raw.experienceBullets : [];

  const experience = sourceExperiences.map((source: any, i: number) => {
    const aiBullets = cleanList(generated[i]?.bullets, 5);
    const sourceBullets = cleanList(source?.bullets, 6);

    return {
      company: source?.company || "",
      title: source?.title || "",
      location: source?.location || "",
      startDate: source?.startDate || "",
      endDate: source?.endDate || "",
      current: Boolean(source?.current),
      dates: source?.dates || "",
      bullets: aiBullets.length ? aiBullets : sourceBullets,
    };
  });

  const sourceSkills = cleanList(profile.skills, 100);
  const sourceSkillMap = new Map(sourceSkills.map((x) => [x.toLowerCase(), x]));
  const aiSkills = cleanList(raw?.skills, 40);
  const skills: string[] = [];

  for (const skill of aiSkills) {
    const exact = sourceSkillMap.get(skill.toLowerCase());
    if (exact && !skills.includes(exact)) skills.push(exact);
  }

  for (const skill of sourceSkills) {
    if (!skills.includes(skill)) skills.push(skill);
  }

  return {
    summary: String(raw?.summary || profile.summary || "").trim(),
    skills: skills.slice(0, 60),
    experience,
    projects: Array.isArray(profile.projects) ? profile.projects : [],
    certifications: cleanList(profile.certifications, 50),
    education: cleanList(profile.education, 20),
    coverLetter: String(raw?.coverLetter || "").trim(),
  };
}

export async function tailor(profile: any, jd: string) {
  const model = process.env.OLLAMA_MODEL || "qwen2.5:1.5b";
  const compactJd = jd.trim().slice(0, 6000);
  const profileText = compactProfile(profile).slice(0, 6000);
  const base = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);

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
              "You are a concise US ATS resume tailoring assistant. Return ONLY valid JSON matching the schema. Use only facts supported by MASTER PROFILE. NEVER invent employers, dates, degrees, certifications, projects, technologies, metrics, responsibilities, achievements, or years of experience. Preserve every source employment fact exactly. Rewrite bullets for JD relevance without inventing facts. Only use skills already present in MASTER PROFILE. Put unsupported JD requirements in missingSkills. Keep summary under 70 words. Keep cover letter under 180 words. Generate 2-5 concise bullets per existing job, in the same order as the MASTER PROFILE jobs.",
          },
          {
            role: "user",
            content:
              "MASTER PROFILE:\n" + profileText +
              "\n\nJOB DESCRIPTION:\n" + compactJd,
          },
        ],
        stream: false,
        format: outputSchema,
        options: {
          temperature: 0.1,
          num_ctx: 4096,
          num_predict: 1200,
        },
        keep_alive: "10m",
      }),
      signal: controller.signal,
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
      keywords: cleanList(raw.atsSkills, 30),
      atsSkills: cleanList(raw.atsSkills, 30),
      responsibilities: [],
      missingSkills: cleanList(raw.missingSkills, 30),
    };

    const normalized = normalizeOutput(raw, profile);

    if (!normalized.summary && !normalized.experience.some((x: any) => x.bullets.length)) {
      throw new Error("AI returned no usable resume content.");
    }

    return {
      analysis,
      research: { source: "disabled", results: [] },
      ...normalized,
    };
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("AI generation timed out after 2 minutes. The local model did not finish within the VPS processing limit.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
