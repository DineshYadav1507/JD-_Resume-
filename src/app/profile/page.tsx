"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const emptyExperience = {
  company: "",
  title: "",
  location: "",
  startDate: "",
  endDate: "",
  current: false,
  dates: "",
  bullets: [""],
};

const emptyProject = {
  name: "",
  description: "",
  technologies: [""],
};

function normalizeExperience(x: any) {
  const dates = x?.dates || "";
  return {
    company: x?.company || "",
    title: x?.title || "",
    location: x?.location || "",
    startDate: x?.startDate || "",
    endDate: x?.endDate || "",
    current: Boolean(x?.current),
    dates,
    bullets: Array.isArray(x?.bullets) && x.bullets.length ? x.bullets : [""],
  };
}

export default function Profile() {
  const [p, setP] = useState<any>({
    name: "",
    headline: "",
    phone: "",
    location: "",
    linkedin: "",
    website: "",
    summary: "",
    skills: [],
    certifications: [],
    experiences: [],
    projects: [],
    education: [],
  });
  const [skillInput, setSkillInput] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const r = useRouter();

  useEffect(() => {
    fetch("/api/profile").then(async (x) => {
      if (!x.ok) {
        r.push("/login");
        return;
      }
      const data = await x.json();
      setP({
        ...data,
        name: data.name || "",
        skills: Array.isArray(data.skills) ? data.skills : [],
        certifications: Array.isArray(data.certifications) ? data.certifications : [],
        experiences: Array.isArray(data.experiences) ? data.experiences.map(normalizeExperience) : [],
        projects: Array.isArray(data.projects) ? data.projects : [],
        education: Array.isArray(data.education) ? data.education : [],
      });
    });
  }, [r]);

  const set = (k: string, v: any) => setP((x: any) => ({ ...x, [k]: v }));

  const add = (k: string, item: any) => set(k, [...(p[k] || []), item]);

  const remove = (k: string, i: number) =>
    set(k, (p[k] || []).filter((_: any, n: number) => n !== i));

  const update = (k: string, i: number, field: string, v: any) =>
    set(
      k,
      (p[k] || []).map((x: any, n: number) =>
        n === i ? { ...x, [field]: v } : x,
      ),
    );

  function addSkill() {
    const value = skillInput.trim();
    if (!value) return;
    if ((p.skills || []).some((x: string) => x.toLowerCase() === value.toLowerCase())) {
      setSkillInput("");
      return;
    }
    set("skills", [...(p.skills || []), value]);
    setSkillInput("");
  }

  async function save() {
    setSaving(true);
    setSaved("");
    const payload = {
      ...p,
      experiences: (p.experiences || []).map((x: any) => ({
        ...normalizeExperience(x),
        dates:
          x.current
            ? `${x.startDate || ""} - Present`.trim()
            : x.startDate || x.endDate
              ? `${x.startDate || ""} - ${x.endDate || ""}`.trim()
              : x.dates || "",
      })),
    };

    const x = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    setSaved(x.ok ? "Saved successfully" : ((await x.json().catch(() => ({}))).error || "Save failed"));
  }

  return (
    <main className="shell">
      <nav className="nav">
        <div>
          <div className="brand">JD Resume AI</div>
          <h1>Master Resume</h1>
          <div className="muted">Your reusable source profile for every tailored application.</div>
        </div>
        <a href="/dashboard" className="btn alt">Dashboard</a>
      </nav>

      <section className="card">
        <h2>Personal information</h2>
        <div className="grid">
          <div className="field">
            <label>Full name</label>
            <input value={p.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Your full name" />
          </div>
          <div className="field">
            <label>Professional headline</label>
            <input value={p.headline || ""} onChange={(e) => set("headline", e.target.value)} placeholder="Software Engineer | Java | Spring Boot | AWS" />
          </div>
          <div className="field">
            <label>Phone</label>
            <input value={p.phone || ""} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="field">
            <label>Location</label>
            <input value={p.location || ""} onChange={(e) => set("location", e.target.value)} placeholder="City, State, Country" />
          </div>
          <div className="field">
            <label>LinkedIn</label>
            <input value={p.linkedin || ""} onChange={(e) => set("linkedin", e.target.value)} />
          </div>
          <div className="field">
            <label>Website / Portfolio</label>
            <input value={p.website || ""} onChange={(e) => set("website", e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Professional summary</label>
          <textarea
            value={p.summary || ""}
            onChange={(e) => set("summary", e.target.value)}
            placeholder="Write your core experience, domain strengths, technologies, and impact. The AI will tailor this section to each JD."
          />
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Skills</h2>
        <div className="field">
          <label>Add a skill</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill();
                }
              }}
              placeholder="Java, AWS, Docker, Kubernetes..."
            />
            <button type="button" className="btn" onClick={addSkill}>Add</button>
          </div>
        </div>
        <div>
          {(p.skills || []).map((x: string, i: number) => (
            <span className="pill" key={`${x}-${i}`}>
              {x}
              <button type="button" onClick={() => remove("skills", i)}>×</button>
            </span>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Experience</h2>
        {(p.experiences || []).map((x: any, i: number) => (
          <div className="card" key={i} style={{ marginTop: 12 }}>
            <div className="grid">
              <div className="field">
                <label>Company</label>
                <input value={x.company || ""} onChange={(e) => update("experiences", i, "company", e.target.value)} />
              </div>
              <div className="field">
                <label>Job title</label>
                <input value={x.title || ""} onChange={(e) => update("experiences", i, "title", e.target.value)} />
              </div>
              <div className="field">
                <label>Job location</label>
                <input value={x.location || ""} onChange={(e) => update("experiences", i, "location", e.target.value)} placeholder="City, State / Remote" />
              </div>
              <div className="field">
                <label>Start date</label>
                <input type="month" value={x.startDate || ""} onChange={(e) => update("experiences", i, "startDate", e.target.value)} />
              </div>
              <div className="field">
                <label>End date</label>
                <input
                  type="month"
                  value={x.endDate || ""}
                  disabled={Boolean(x.current)}
                  onChange={(e) => update("experiences", i, "endDate", e.target.value)}
                />
              </div>
              <div className="field" style={{ display: "flex", alignItems: "end" }}>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(x.current)}
                    onChange={(e) => update("experiences", i, "current", e.target.checked)}
                  />{" "}
                  Currently working here
                </label>
              </div>
            </div>

            <div className="field">
              <label>Achievement / responsibility bullets</label>
              <textarea
                value={(x.bullets || []).join("\n")}
                onChange={(e) => update("experiences", i, "bullets", e.target.value.split("\n"))}
                placeholder="One achievement or responsibility per line"
              />
            </div>

            <button type="button" className="btn alt" onClick={() => remove("experiences", i)}>Remove experience</button>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => add("experiences", { ...emptyExperience, bullets: [""] })}>+ Add experience</button>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Projects</h2>
        {(p.projects || []).map((x: any, i: number) => (
          <div className="card" key={i} style={{ marginTop: 12 }}>
            <div className="field">
              <label>Project name</label>
              <input value={x.name || ""} onChange={(e) => update("projects", i, "name", e.target.value)} />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea value={x.description || ""} onChange={(e) => update("projects", i, "description", e.target.value)} />
            </div>
            <div className="field">
              <label>Technologies</label>
              <input
                value={(x.technologies || []).join(", ")}
                onChange={(e) => update("projects", i, "technologies", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
              />
            </div>
            <button type="button" className="btn alt" onClick={() => remove("projects", i)}>Remove project</button>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => add("projects", { ...emptyProject, technologies: [""] })}>+ Add project</button>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Certifications & Education</h2>
        <div className="field">
          <label>Certifications (one per line)</label>
          <textarea value={(p.certifications || []).join("\n")} onChange={(e) => set("certifications", e.target.value.split("\n").map((x: string) => x.trim()).filter(Boolean))} />
        </div>
        <div className="field">
          <label>Education (one per line)</label>
          <textarea value={(p.education || []).join("\n")} onChange={(e) => set("education", e.target.value.split("\n").map((x: string) => x.trim()).filter(Boolean))} />
        </div>
      </section>

      <div style={{ position: "sticky", bottom: 16, marginTop: 18 }}>
        <button type="button" className="btn" disabled={saving} onClick={save}>
          {saving ? "Saving..." : "Save Master Resume"}
        </button>
        <span className="success">{saved}</span>
      </div>
    </main>
  );
}
