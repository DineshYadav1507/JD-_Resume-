import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
}

function score(a: any, r: any) {
  const jdSkills = toStringArray(a?.atsSkills).map((x) => x.toLowerCase());
  const resumeSkills = toStringArray(r?.skills).map((x) => x.toLowerCase());

  const jd = new Set(jdSkills);
  const matched = [...jd].filter((x) =>
    resumeSkills.some((s) => s.includes(x) || x.includes(s)),
  );

  return {
    matched,
    score: jd.size ? Math.round((matched.length / jd.size) * 100) : 0,
  };
}

export default async function JobResult({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const u = await currentUser();
  if (!u) redirect("/login");

  const { id } = await params;

  const j = await db.job.findFirst({
    where: {
      id,
      userId: u.id,
    },
  });

  if (!j) notFound();

  if (j.status === "GENERATING") {
    return (
      <main className="shell">
        <meta httpEquiv="refresh" content="5" />
        <section className="card hero">
          <h1>Generating your tailored application…</h1>
          <p className="muted">
            Ollama is analyzing the JD and tailoring your resume. This page checks the job status automatically.
          </p>
          <p className="muted">Please keep this tab open. The Generate request is no longer blocking the browser.</p>
        </section>
      </main>
    );
  }

  if (j.status === "FAILED") {
    return (
      <main className="shell">
        <section className="card hero">
          <h1>Generation failed</h1>
          <p className="muted">
            The local AI generation did not complete. No credit was charged for this failed job.
          </p>
          <a className="btn" href="/dashboard">Try again</a>
        </section>
      </main>
    );
  }

  if (j.status !== "COMPLETED") notFound();

  const a: any = j.analysis;
  const t: any = j.tailoredResume;
  const s = score(a, t);
  const atsSkills = toStringArray(a?.atsSkills);
  const missingSkills = toStringArray(a?.missingSkills);
  const tailoredSkills = toStringArray(t?.skills);

  return (
    <main className="shell">
      <nav className="nav">
        <div>
          <div className="brand">JD Resume AI</div>
          <div className="muted">
            {j.title || "Tailored application"} · {j.company || "Company"}
          </div>
        </div>
        <a className="btn alt" href="/dashboard">
          New Application
        </a>
      </nav>

      <div className="grid">
        <section className="card">
          <h2>ATS Analysis</h2>
          <div className="stat">
            <strong>{s.score}%</strong>
            <span className="muted">skill coverage</span>
          </div>

          <h3>Matched keywords</h3>
          <div>
            {s.matched.map((x) => (
              <span className="pill" key={x}>
                {x}
              </span>
            ))}
          </div>

          <h3>JD requirements</h3>
          <div>
            {atsSkills.map((x) => (
              <span className="pill" key={x}>
                {x}
              </span>
            ))}
          </div>

          <h3>Potential gaps</h3>
          {missingSkills.length ? (
            <ul>
              {missingSkills.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            <p className="success">
              No major unsupported requirements identified.
            </p>
          )}
        </section>

        <section className="card">
          <h2>Generated Documents</h2>

          <h3>Resume Summary</h3>
          <p>{t?.summary}</p>

          <h3>Core Skills</h3>
          <div>
            {tailoredSkills.map((x) => (
              <span className="pill" key={x}>
                {x}
              </span>
            ))}
          </div>

          <p>
            <a
              className="btn"
              href={"/api/jobs/" + j.id + "/download?type=resume"}
            >
              Download Resume DOCX
            </a>
          </p>

          <p>
            <a
              className="btn alt"
              href={"/api/jobs/" + j.id + "/download?type=cover"}
            >
              Download Cover Letter DOCX
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
