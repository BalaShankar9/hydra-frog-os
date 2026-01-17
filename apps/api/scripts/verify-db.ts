import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.info('Verifying database connection...');
  console.info('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));

  try {
    // Test connection
    await prisma.$connect();
    console.info('Database connection successful!');

    // Query demo org
    const demoOrg = await prisma.org.findFirst({
      where: { name: 'Demo Organization' },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        projects: true,
      },
    });

    if (demoOrg) {
      console.info('\n--- Demo Organization ---');
      console.info('ID:', demoOrg.id);
      console.info('Name:', demoOrg.name);
      console.info('Created:', demoOrg.createdAt);

      console.info('\n--- Members ---');
      for (const member of demoOrg.members) {
        console.info(`  - ${member.user.email} (${member.role})`);
      }

      console.info('\n--- Projects ---');
      for (const project of demoOrg.projects) {
        console.info(`  - ${project.name} (${project.domain})`);
        console.info(`    Start URL: ${project.startUrl}`);
      }
    } else {
      console.warn('No demo organization found. Run db:seed first.');
    }

    // Count all records
    const counts = {
      users: await prisma.user.count(),
      orgs: await prisma.org.count(),
      projects: await prisma.project.count(),
      crawlRuns: await prisma.crawlRun.count(),
      pages: await prisma.page.count(),
      links: await prisma.link.count(),
      issues: await prisma.issue.count(),
    };

    console.info('\n--- Record Counts ---');
    for (const [model, count] of Object.entries(counts)) {
      console.info(`  ${model}: ${count}`);
    }

    console.info('\nVerification completed successfully!');
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
