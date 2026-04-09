import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { hashPassword } from '../security/password.service';

const prisma = new PrismaClient();

interface CompleteFirstLoginPasswordChangeInput {
  userId: string;
  newPassword: string;
  actorUserId?: string;
}

export async function completeFirstLoginPasswordChange(
  input: CompleteFirstLoginPasswordChangeInput,
): Promise<void> {
  const txId = randomUUID();
  const newHash = hashPassword(input.newPassword);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: input.userId } });
    if (!user || user.isDeleted) {
      throw new Error('User not found.');
    }
    if (!user.forcePasswordChange) {
      return;
    }

    await tx.user.update({
      where: { id: input.userId },
      data: {
        passwordHash: newHash,
        forcePasswordChange: false,
        passwordChangedAt: new Date(),
      },
    });

    await tx.accessProvisioning.updateMany({
      where: {
        userId: input.userId,
        forcedPasswordChangedAt: null,
      },
      data: {
        statusCode: 'active',
        forcedPasswordChangedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        txId,
        userId: input.actorUserId ?? input.userId,
        module: 'auth',
        entity: 'user',
        entityId: input.userId,
        actionType: 'FIRST_LOGIN_PASSWORD_CHANGED',
        oldValueJson: { forcePasswordChange: true },
        newValueJson: { forcePasswordChange: false },
      },
    });
  });
}
