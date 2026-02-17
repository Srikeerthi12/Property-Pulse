import nodemailer from 'nodemailer';

export function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port,
    auth: user ? { user, pass } : undefined,
  });
}

export async function sendEmail({ to, subject, text }) {
  const enabled = String(process.env.EMAIL_ENABLED || 'false') === 'true';
  if (!enabled) return { skipped: true };

  const transport = createTransport();
  if (!transport) throw new Error('SMTP transport not configured');

  const from = process.env.EMAIL_FROM || 'PropertyPulse <no-reply@propertypulse.local>';
  return transport.sendMail({ from, to, subject, text });
}
