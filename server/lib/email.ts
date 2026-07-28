export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

// No real provider wired in yet (Resend/SendGrid deliberately deferred) —
// logs instead of sending. Swap the body of this function for a real
// provider call later; every caller already treats this as fire-and-forget.
export async function sendEmail(message: EmailMessage): Promise<void> {
  console.log(`[email:stub] to=${message.to} subject="${message.subject}"\n${message.body}`);
}
