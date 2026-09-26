import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tailor } from "@/lib/engine";

export const maxDuration = 300;

function authorized(req: Request) {
  const expected = process.env.GENERATION_WORKER_SECRET;
  const supplied = req.headers.get("x-generation-worker-secret");
  return Boolean(expected && supplied && supplied === expected);
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const job = await db.job.findFirst({
    where: { status: "GENERATING" },
    orderBy: { createdAt: "asc" },
    include: { user: { include: { profile: true } } },
  });

  if (!job || !job.user.profile) {
    return NextResponse.json({ processed: false });
  }

  try {
    console.log("[JD Resume AI] worker processing job", job.id);

    const out = await tailor(
      { ...job.user.profile, user: job.user },
      job.description,
    );

    await db.$transaction(async (tx) => {
      const debit = await tx.user.updateMany({
        where: { id: job.userId, credits: { gte: 1 } },
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
          userId: job.userId,
          amount: -1,
          reason: "Resume + cover letter generation",
        },
      });
    });

    console.log("[JD Resume AI] worker completed job", job.id);
    return NextResponse.json({ processed: true, jobId: job.id, status: "COMPLETED" });
  } catch (e: any) {
    console.error("[JD Resume AI] worker failed", job.id, e);

    await db.job.update({
      where: { id: job.id },
      data: { status: "FAILED" },
    }).catch(() => undefined);

    return NextResponse.json({
      processed: true,
      jobId: job.id,
      status: "FAILED",
      error: e?.message || "Generation failed",
    }, { status: 500 });
  }
}
