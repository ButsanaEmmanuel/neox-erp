import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

/**
 * Example worker that consumes hrm.onboarding.access_email.requested events.
 * Replace console transport with real SMTP/provider integration.
 */
export async function processWelcomeAccessEmailEvents(): Promise<void> {
  const pendingEvents = await prisma.domainEvent.findMany({
    where: {
      eventType: 'hrm.onboarding.access_email.requested',
      publishedAt: null,
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  for (const event of pendingEvents) {
    const payload = event.payloadJson as {
      to: string;
      companyName: string;
      appUrl: string;
      username: string;
      temporaryPassword: string;
      instruction: string;
    };

    // Replace with actual email provider call.
    // eslint-disable-next-line no-console
    console.log('[EMAIL OUTBOUND]', {
      subject: `Bienvenue chez ${payload.companyName} - Vos acces a la plateforme.`,
      to: payload.to,
      content: {
        appUrl: payload.appUrl,
        username: payload.username,
        temporaryPassword: payload.temporaryPassword,
        instruction: payload.instruction,
      },
    });

    const auditTxId = randomUUID();
    await prisma.$transaction([
      prisma.domainEvent.update({
        where: { id: event.id },
        data: { publishedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          txId: auditTxId,
          module: 'notification',
          entity: 'email',
          entityId: event.id,
          actionType: 'WELCOME_ACCESS_EMAIL_SENT',
          newValueJson: {
            to: payload.to,
            subject: `Bienvenue chez ${payload.companyName} - Vos acces a la plateforme.`,
          },
        },
      }),
    ]);
  }
}
