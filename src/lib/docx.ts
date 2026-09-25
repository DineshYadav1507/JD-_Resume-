import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

function experienceDates(experience: any) {
  if (experience?.current && experience?.startDate) {
    return `${experience.startDate} - Present`;
  }
  if (experience?.startDate || experience?.endDate) {
    return [experience.startDate, experience.endDate].filter(Boolean).join(" - ");
  }
  return experience?.dates || "";
}

export async function makeResumeDoc(profile: any, data: any) {
  const children: Paragraph[] = [];

  const add = (text: string, bold = false) => {
    children.push(
      new Paragraph({
        children: [new TextRun({ text, bold, size: 20 })],
        spacing: { after: 90 },
      }),
    );
  };

  const name = profile.user?.name || profile.name || "";
  const contact = [
    profile.phone,
    profile.user?.email,
    profile.location,
    profile.linkedin,
    profile.website,
  ].filter(Boolean).join(" | ");

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: name, bold: true, size: 32 })],
    }),
  );

  if (profile.headline) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: profile.headline, bold: true, size: 20 })],
      }),
    );
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: contact, size: 18 })],
    }),
  );

  add("PROFESSIONAL SUMMARY", true);
  add(data.summary || profile.summary || "");

  add("CORE SKILLS", true);
  add((data.skills || []).join(" • "));

  add("PROFESSIONAL EXPERIENCE", true);

  for (const experience of data.experience || []) {
    const dates = experienceDates(experience);
    const location = experience.location ? ` | ${experience.location}` : "";

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${experience.title || ""} — ${experience.company || ""}`,
            bold: true,
            size: 22,
          }),
          new TextRun({
            text: dates || location ? ` | ${dates}${location}` : "",
            size: 20,
          }),
        ],
      }),
    );

    for (const bullet of experience.bullets || []) {
      if (!bullet?.trim()) continue;
      children.push(
        new Paragraph({
          text: bullet,
          bullet: { level: 0 },
          spacing: { after: 60 },
        }),
      );
    }
  }

  if (data.projects?.length) {
    add("SELECTED PROJECTS", true);
    for (const project of data.projects) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: project.name || "", bold: true, size: 21 })],
        }),
      );
      children.push(new Paragraph({ text: project.description || "" }));
      if (project.technologies?.length) {
        children.push(
          new Paragraph({
            text: `Technologies: ${project.technologies.join(", ")}`,
          }),
        );
      }
    }
  }

  if (data.certifications?.length) {
    add("CERTIFICATIONS", true);
    for (const certification of data.certifications) {
      children.push(new Paragraph({ text: certification, bullet: { level: 0 } }));
    }
  }

  if (data.education?.length) {
    add("EDUCATION", true);
    for (const education of data.education) {
      children.push(new Paragraph({ text: education, bullet: { level: 0 } }));
    }
  }

  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}

export async function makeCoverDoc(profile: any, cover: string, job: any) {
  const name = profile.user?.name || profile.name || "";
  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: name, bold: true, size: 30 })],
    }),
    new Paragraph({
      text: [profile.phone, profile.user?.email, profile.location, profile.linkedin]
        .filter(Boolean)
        .join(" | "),
    }),
    new Paragraph({ text: "" }),
    new Paragraph({ text: new Date().toLocaleDateString("en-US") }),
    new Paragraph({ text: "" }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Hiring Manager\\n${job.company || "Hiring Team"}\\n${job.title || "Open Position"}`,
          bold: true,
          size: 21,
        }),
      ],
    }),
    new Paragraph({ text: "" }),
  ];

  for (const paragraph of (cover || "").split(/\\n+/)) {
    if (paragraph.trim()) {
      children.push(new Paragraph({ text: paragraph, spacing: { after: 150 } }));
    }
  }

  children.push(
    new Paragraph({ text: "Sincerely," }),
    new Paragraph({ text: name }),
  );

  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}
