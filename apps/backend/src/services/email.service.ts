import { env } from '../config/env';
import { logger } from '../config/logger';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendViaResend(options: SendEmailOptions) {
  const { Resend } = await import('resend');
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

async function sendViaConsole(options: SendEmailOptions) {
  logger.info(
    { to: options.to, subject: options.subject },
    '[DEV] Email simulado — configure RESEND_API_KEY para envio real'
  );
  logger.debug({ html: options.html }, '[DEV] Email HTML');
}

export const emailService = {
  async send(options: SendEmailOptions) {
    if (env.RESEND_API_KEY) {
      await sendViaResend(options);
    } else {
      await sendViaConsole(options);
    }
  },

  async sendEmailVerification(to: string, token: string) {
    const link = `${env.FRONTEND_URL}/auth/verify-email?token=${token}`;
    await this.send({
      to,
      subject: 'Confirme seu email — AppFin',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#22c55e">Bem-vindo ao AppFin!</h2>
          <p>Clique no botão abaixo para confirmar seu endereço de email.</p>
          <a href="${link}" style="display:inline-block;background:#22c55e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">
            Confirmar email
          </a>
          <p style="color:#6b7280;font-size:13px">O link expira em 24 horas. Se não foi você, ignore este email.</p>
        </div>
      `,
    });
  },

  async sendBudgetAlert(
    to: string,
    opts: {
      userName: string;
      categoryName: string;
      month: string;
      spent: number;
      limit: number;
      percent: number;
      level: 80 | 100;
    }
  ) {
    const fmt = (v: number) =>
      v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const isOver = opts.level === 100;
    const color = isOver ? '#ef4444' : '#f97316';
    const title = isOver
      ? `Orçamento estourado — ${opts.categoryName}`
      : `Alerta de orçamento — ${opts.categoryName}`;
    const headline = isOver
      ? `Você atingiu 100% do orçamento de ${opts.categoryName} em ${opts.month}.`
      : `Você atingiu ${Math.round(opts.percent)}% do orçamento de ${opts.categoryName} em ${opts.month}.`;

    await this.send({
      to,
      subject: `${title} — AppFin`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:${color}">${title}</h2>
          <p>Olá, <strong>${opts.userName}</strong>!</p>
          <p>${headline}</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr>
              <td style="padding:8px;background:#f9fafb;border-radius:4px 0 0 4px;color:#6b7280;font-size:13px">Gasto atual</td>
              <td style="padding:8px;text-align:right;font-weight:600">${fmt(opts.spent)}</td>
            </tr>
            <tr>
              <td style="padding:8px;color:#6b7280;font-size:13px">Limite</td>
              <td style="padding:8px;text-align:right;font-weight:600">${fmt(opts.limit)}</td>
            </tr>
            <tr>
              <td style="padding:8px;background:#f9fafb;color:#6b7280;font-size:13px;border-radius:0 0 0 4px">Restante</td>
              <td style="padding:8px;text-align:right;font-weight:600;color:${isOver ? '#ef4444' : '#22c55e'}">${fmt(Math.max(0, opts.limit - opts.spent))}</td>
            </tr>
          </table>
          <div style="background:#f3f4f6;border-radius:8px;height:12px;margin:16px 0;overflow:hidden">
            <div style="background:${color};height:100%;width:${Math.min(100, Math.round(opts.percent))}%"></div>
          </div>
          <p style="color:#6b7280;font-size:13px">Acesse o AppFin para ver seus orçamentos e transações.</p>
        </div>
      `,
    });
  },

  async sendPasswordReset(to: string, token: string) {
    const link = `${env.FRONTEND_URL}/auth/reset-password?token=${token}`;
    await this.send({
      to,
      subject: 'Redefinição de senha — AppFin',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#3b82f6">Redefinição de senha</h2>
          <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
          <a href="${link}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">
            Redefinir senha
          </a>
          <p style="color:#6b7280;font-size:13px">O link expira em 1 hora. Se não foi você, ignore este email.</p>
        </div>
      `,
    });
  },
};
