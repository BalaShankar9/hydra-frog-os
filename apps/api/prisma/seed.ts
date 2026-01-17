import 'dotenv/config';
import { PrismaClient, OrgRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.info('Seeding database...');

  // Create demo user
  // Password: password123
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@hydra.local' },
    update: {
      passwordHash: '$2b$10$PAdC6Tjw2N8U2JukAaSfyePUQLKVIEweSI3WM2SQUzjpe9AngeW6O',
    },
    create: {
      email: 'demo@hydra.local',
      passwordHash: '$2b$10$PAdC6Tjw2N8U2JukAaSfyePUQLKVIEweSI3WM2SQUzjpe9AngeW6O',
    },
  });
  console.info('Created demo user:', demoUser.email);

  // Create demo org
  const demoOrg = await prisma.org.upsert({
    where: { id: 'demo-org-id' },
    update: {},
    create: {
      id: 'demo-org-id',
      name: 'Demo Organization',
    },
  });
  console.info('Created demo org:', demoOrg.name);

  // Create org member (link user to org)
  const orgMember = await prisma.orgMember.upsert({
    where: {
      orgId_userId: {
        orgId: demoOrg.id,
        userId: demoUser.id,
      },
    },
    update: {},
    create: {
      orgId: demoOrg.id,
      userId: demoUser.id,
      role: OrgRole.ADMIN,
    },
  });
  console.info('Created org member with role:', orgMember.role);

  // Create demo project
  const demoProject = await prisma.project.upsert({
    where: { id: 'demo-project-id' },
    update: {},
    create: {
      id: 'demo-project-id',
      orgId: demoOrg.id,
      name: 'Demo Project',
      domain: 'example.com',
      startUrl: 'https://example.com',
      settingsJson: {
        maxPages: 100,
        crawlDelay: 1000,
        respectRobotsTxt: true,
      },
    },
  });
  console.info('Created demo project:', demoProject.name);

  console.info('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
