import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "@/generated/prisma/client";

// Hot reload preserves globalThis, including clients generated for an older schema.
const schemaSignature = JSON.stringify(
  Object.entries(Prisma).filter(([name]) => name.endsWith("ScalarFieldEnum")),
);

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaSignature?: string;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to connect to PostgreSQL.");
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma && globalForPrisma.prismaSchemaSignature !== schemaSignature) {
    const staleClient = globalForPrisma.prisma;
    globalForPrisma.prisma = undefined;
    void staleClient.$disconnect().catch((error: unknown) => {
      console.error("Could not disconnect stale Prisma Client", error);
    });
  }
  const client = globalForPrisma.prisma ?? createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaSchemaSignature = schemaSignature;
  }

  return client;
}
