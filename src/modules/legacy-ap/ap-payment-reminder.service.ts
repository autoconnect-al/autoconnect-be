import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { legacySuccess } from '../../common/legacy-response';
import { Resend } from 'resend';

@Injectable()
export class ApPaymentReminderService {
  constructor(private readonly prisma: PrismaService) {}

  async sendRemindEmails() {
    const now = Date.now();
    const threeDayUpper = new Date(now - 11 * 24 * 3600 * 1000);
    const threeDayLower = new Date(now - 12 * 24 * 3600 * 1000);
    const oneDayUpper = new Date(now - 14 * 24 * 3600 * 1000);
    const oneDayLower = new Date(now - 15 * 24 * 3600 * 1000);

    const [threeDayOrders, oneDayOrders] = await Promise.all([
      this.prisma.customer_orders.findMany({
        where: {
          dateUpdated: {
            lte: threeDayUpper,
            gt: threeDayLower,
          },
          email: { not: null },
        },
      }),
      this.prisma.customer_orders.findMany({
        where: {
          dateUpdated: {
            lte: oneDayUpper,
            gt: oneDayLower,
          },
          email: { not: null },
        },
      }),
    ]);

    const apiKey = this.toSafeString(process.env.RESEND_API_KEY);
    const resend = apiKey ? new Resend(apiKey) : null;
    const sent = { oneDay: 0, threeDay: 0 };

    const sendBatch = async (
      rows: Array<{ email: string | null; postId: string | null }>,
      daysLeft: '1' | '3',
    ) => {
      for (const row of rows) {
        const email = this.toSafeString(row.email);
        const postId = this.toSafeString(row.postId);
        if (!email || !postId || !resend) continue;

        const link = `https://autoconnect.al/sq-al/automjete/makine-ne-shitje/${postId}`;
        try {
          await resend.emails.send({
            from: 'info@autoconnect.al',
            to: [email],
            subject: 'Promovimi i postimit tuaj skadon se shpejti',
            html: `
              <strong>Promovimi i postimit tuaj skadon se shpejti</strong>
              <p>Postimit tuaj i kane mbetur vetem ${daysLeft} dite nga promovimi aktiv.</p>
              <p><a href="${link}">Shiko postin</a></p>
              <p>Faleminderit,<br/>Ekipi i Autoconnect</p>
            `,
          });
          if (daysLeft === '1') sent.oneDay += 1;
          if (daysLeft === '3') sent.threeDay += 1;
        } catch {
          // Keep endpoint resilient; continue with next recipient.
        }
      }
    };

    await sendBatch(threeDayOrders, '3');
    await sendBatch(oneDayOrders, '1');

    return legacySuccess({
      oneDayCandidates: oneDayOrders.length,
      threeDayCandidates: threeDayOrders.length,
      sent,
      emailDeliveryEnabled: Boolean(resend),
    });
  }

  private toSafeString(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  }
}
