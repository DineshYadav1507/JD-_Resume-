import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

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

    return NextResponse.json({
      jobId: job.id,
      status: "GENERATING",
    });
  } catch (e: any) {
    return NextResponse.json({
      error: e?.message || "Invalid request",
    }, { status: 400 });
  }
}
