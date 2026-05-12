import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as typeof globalThis & {
  commHubPrisma?: PrismaClient;
};

export const prisma = globalForPrisma.commHubPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.commHubPrisma = prisma;
}
