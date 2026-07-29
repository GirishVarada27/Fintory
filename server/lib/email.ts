export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

// onboarding@resend.dev works without verifying a custom sending domain —
// fine for a personal project. Set RESEND_FROM_EMAIL once a verified domain
// exists to send from a real address instead.
const DEFAULT_FROM = "Fintory <onboarding@resend.dev>";

interface ResendErrorBody {
  message?: string;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email:stub] to=${message.to} subject="${message.subject}"\n${message.body}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM,
      to: message.to,
      subject: message.subject,
      text: message.body,
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ResendErrorBody;
    console.error(`[email] Resend send failed (${res.status}): ${body.message ?? res.statusText}`);
  }
}
