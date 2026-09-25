import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.user.upsert({
    where: { email },
    update: {
      role: "ADMIN",
      passwordHash,
    },
    create: {
      name: "Administrator",
      email,
      passwordHash,
      role: "ADMIN",
      credits: 999,
      profile: {
        create: {
          skills: [],
          certifications: [],
          experiences: [],
          projects: [],
          education: [],
        },
      },
    },
  });

  console.log("Admin ready:", user.email);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
