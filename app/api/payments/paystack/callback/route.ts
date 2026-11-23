import { NextResponse } from 'next/server'
import { confirmPaystackPayment } from '@/lib/payment-confirmation'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const reference =
    url.searchParams.get('reference') ?? url.searchParams.get('trxref') ?? ''
  const siteUrl = process.env.BETTER_AUTH_URL?.trim()

  if (!siteUrl) {
    return NextResponse.json(
      { error: 'Payment callback is not configured.' },
      { status: 503 },
    )
  }

  if (!reference || reference.length > 200) {
    return NextResponse.redirect(new URL('/payment/pending', siteUrl))
  }

  try {
    await confirmPaystackPayment(reference)
    return NextResponse.redirect(new URL('/payment/complete', siteUrl))
  } catch (error) {
    console.error('Paystack callback could not confirm the payment:', error)
    return NextResponse.redirect(new URL('/payment/pending', siteUrl))
  }
}
