# Hostinger VPS deployment

1. Install Node.js 20+, PostgreSQL 15+, Nginx and PM2.
2. Clone the repository.
3. Create .env from .env.example and set DATABASE_URL, OPENAI_API_KEY, SERPAPI_API_KEY and a long JWT_SECRET.
4. npm install
5. npx prisma generate
6. npx prisma migrate deploy
7. Set ADMIN_EMAIL and ADMIN_PASSWORD, then run the seed script with your preferred TypeScript runner (for example npx tsx scripts/seed-admin.ts).
8. npm run build
9. pm2 start npm --name jd-resume-ai -- start
10. Configure Nginx to proxy your domain to localhost:3000 and enable HTTPS.

Recommended production additions: object storage for generated documents, Redis/BullMQ for long-running generations, rate limiting, email verification, password reset, audit logs, billing provider, malware scanning for uploads, and automated tests.
