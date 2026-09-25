import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

export async function makeResumeDoc(profile: any, data: any) {
  const children: Paragraph[] = [];

  const add = (text: string, bold = false) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold,
            size: 20,
          }),
        ],
        spacing: { after: 90 },
      }),
    );
  };

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: profile.user.name,
          bold: true,
          size: 32,
        }),
      ],
    }),
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: [
            profile.phone,
            profile.user.email,
            profile.location,
            profile.linkedin,
          ]
            .filter(Boolean)
            .join(" | "),
          size: 18,
        }),
      ],
    }),
  );

  add("PROFESSIONAL SUMMARY", true);
  add(data.summary || "");

  add("CORE SKILLS", true);
  add((data.skills || []).join(" • "));

  add("PROFESSIONAL EXPERIENCE", true);

  for (const experience of data.experience || []) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${experience.title || ""} — ${experience.company || ""}`,
            bold: true,
            size: 22,
          }),
          new TextRun({
            text: experience.dates ? ` | ${experience.dates}` : "",
            size: 20,
          }),
        ],
      }),
    );

    for (const bullet of experience.bullets || []) {
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
          children: [
            new TextRun({
              text: project.name || "",
              bold: true,
              size: 21,
            }),
          ],
        }),
      );

      children.push(
        new Paragraph({
          text: project.description || "",
        }),
      );

      children.push(
        new Paragraph({
          text: `Technologies: ${(project.technologies || []).join(", ")}`,
        }),
      );
    }
  }

  if (data.certifications?.length) {
    add("CERTIFICATIONS", true);

    for (const certification of data.certifications) {
      children.push(
        new Paragraph({
          text: certification,
          bullet: { level: 0 },
        }),
      );
    }
  }

  if (data.education?.length) {
    add("EDUCATION", true);

    for (const education of data.education) {
      children.push(
        new Paragraph({
          text: education,
          bullet: { level: 0 },
        }),
      );
    }
  }

  return Packer.toBuffer(
    new Document({
      sections: [{ children }],
    }),
  );
}

export async function makeCoverDoc(
  profile: any,
  cover: string,
  job: any,
) {
  const children: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: profile.user.name,
          bold: true,
          size: 30,
        }),
      ],
    }),
    new Paragraph({
      text: [
        profile.phone,
        profile.user.email,
        profile.location,
      ]
        .filter(Boolean)
        .join(" | "),
    }),
    new Paragraph({ text: "" }),
    new Paragraph({
      text: new Date().toLocaleDateString("en-US"),
    }),
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

  for (const paragraph of cover.split(/\\n+/)) {
    children.push(
      new Paragraph({
        text: paragraph,
        spacing: { after: 150 },
      }),
    );
  }

  children.push(
    new Paragraph({ text: "Sincerely," }),
    new Paragraph({ text: profile.user.name }),
  );

  return Packer.toBuffer(
    new Document({
      sections: [{ children }],
    }),
  );
}
