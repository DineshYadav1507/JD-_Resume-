import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const experienceSchema = z.object({
  company: z.string().max(200),
  title: z.string().max(200),
  location: z.string().max(160).optional(),
  startDate: z.string().max(40).optional(),
  endDate: z.string().max(40).optional(),
  current: z.boolean().optional(),
  dates: z.string().max(100).optional(),
  bullets: z.array(z.string().max(1000)).max(30),
});

const S = z.object({
  name: z.string().trim().min(2).max(160),
  headline: z.string().max(200).optional(),
  phone: z.string().max(80).optional(),
  location: z.string().max(160).optional(),
  linkedin: z.string().max(500).optional(),
  website: z.string().max(500).optional(),
  summary: z.string().max(4000).optional(),
  skills: z.array(z.string().trim().min(1).max(100)).max(150),
  certifications: z.array(z.string().trim().min(1).max(250)).max(50),
  experiences: z.array(experienceSchema).max(30),
  projects: z.array(z.object({
    name: z.string().max(200),
    description: z.string().max(3000),
    technologies: z.array(z.string().max(100)).max(50),
  })).max(50),
  education: z.array(z.string().trim().min(1).max(500)).max(20),
});

export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    name: u.name,
    headline: u.profile?.headline || "",
    phone: u.profile?.phone || "",
    location: u.profile?.location || "",
    linkedin: u.profile?.linkedin || "",
    website: u.profile?.website || "",
    summary: u.profile?.summary || "",
    skills: u.profile?.skills || [],
    certifications: u.profile?.certifications || [],
    experiences: u.profile?.experiences || [],
    projects: u.profile?.projects || [],
    education: u.profile?.education || [],
  });
}

export async function PUT(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const b = S.parse(await req.json());

    const p = await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: u.id },
        data: { name: b.name },
      });

      return tx.resumeProfile.upsert({
        where: { userId: u.id },
        create: {
          userId: u.id,
          headline: b.headline || null,
          phone: b.phone || null,
          location: b.location || null,
          linkedin: b.linkedin || null,
          website: b.website || null,
          summary: b.summary || null,
          skills: b.skills,
          certifications: b.certifications,
          experiences: b.experiences,
          projects: b.projects,
          education: b.education,
        },
        update: {
          headline: b.headline || null,
          phone: b.phone || null,
          location: b.location || null,
          linkedin: b.linkedin || null,
          website: b.website || null,
          summary: b.summary || null,
          skills: b.skills,
          certifications: b.certifications,
          experiences: b.experiences,
          projects: b.projects,
          education: b.education,
        },
      });
    });

    return NextResponse.json({ ok: true, name: b.name, profile: p });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid profile data" }, { status: 400 });
  }
}
