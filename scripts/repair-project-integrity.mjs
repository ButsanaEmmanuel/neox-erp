import { PrismaClient } from "@prisma/client";
import { repairProjectIntegrity } from "../backend/services/projects/projectCollaboration.service.mjs";

const prisma = new PrismaClient();

try {
  const result = await repairProjectIntegrity(prisma, {
    actorUserId: null,
    actorDisplayName: "SystemRepair",
  });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

