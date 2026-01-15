import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend = new Resend(process.env.RESEND_API_KEY);

  async sendPasswordReset(email: string, resetLink: string) {
    await this.resend.emails.send({
      from: 'AutoConnect <info@autoconnect.al>',
      to: email,
      subject: 'Reset your AutoConnect password',
      html: `
        <p>You requested a password reset.</p>
        <p>
          <a href="${resetLink}">
            Click here to reset your password
          </a>
        </p>
        <p>This link expires in 30 minutes.</p>
      `,
    });
  }
}
