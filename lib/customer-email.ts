import {
  assertDropaphiConfiguration,
  sendTransactionalEmail,
} from '@/lib/dropaphi'
import {
  renderBrandedEmail,
  type BrandedEmailContent,
} from '@/lib/email-template'

type CustomerEmail = {
  to: string
  subject: string
  content: BrandedEmailContent
  metadata?: Record<string, string>
}

export function assertCustomerEmailConfiguration() {
  assertDropaphiConfiguration()
}

export async function sendCustomerEmail(email: CustomerEmail) {
  assertCustomerEmailConfiguration()
  const { html, text } = renderBrandedEmail(email.content)
  await sendTransactionalEmail({
    to: email.to,
    subject: email.subject,
    html,
    text,
    fromName: 'TinaJoe.Studio',
    metadata: email.metadata,
  })
}
