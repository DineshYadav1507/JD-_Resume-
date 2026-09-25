import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { tailor } from "@/lib/engine";
import { z } from "zod";

export const maxDuration = 300;

export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { description } = z.object({
      description: z.string().trim().min(80).max(50000),
    }).parse(await req.json());

    if (!u.profile) {
      return NextResponse.json({ error: "Complete your master profile first." }, { status: 400 });
    }

    if (u.credits < 1) {
      return NextResponse.json({ error: "No credits available." }, { status: 402 });
    }

    const job = await db.job.create({
      data: { userId: u.id, description, status: "GENERATING" },
    });

    try {
      const out = await tailor({ ...u.profile, user: u }, description);

      await db.$transaction(async (tx) => {
        const debit = await tx.user.updateMany({
          where: { id: u.id, credits: { gte: 1 } },
          data: { credits: { decrement: 1 } },
        });

        if (debit.count !== 1) throw new Error("No credits available.");

        await tx.job.update({
          where: { id: job.id },
          data: {
            title: out.analysis.title,
            company: out.analysis.company,
            location: out.analysis.location,
            research: out.research,
            analysis: out.analysis,
            tailoredResume: out,
            coverLetter: out.coverLetter,
            status: "COMPLETED",
          },
        });

        await tx.creditLedger.create({
          data: {
            userId: u.id,
            amount: -1,
            reason: "Resume + cover letter generation",
          },
        });
      });

      return NextResponse.json({ jobId: job.id });
    } catch (e: any) {
      await db.job.update({
        where: { id: job.id },
        data: { status: "FAILED" },
      }).catch(() => undefined);

      return NextResponse.json({
        error: e?.message || "Generation failed",
      }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({
      error: e?.message || "Invalid request",
    }, { status: 400 });
  }
}
