import Link from 'next/link'

export default function PaymentCompletePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-16 text-foreground">
      <section className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 text-center shadow-sm md:p-12">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Payment confirmed
        </p>
        <h1 className="mt-4 font-serif text-4xl">
          Thank you for your order.
        </h1>
        <p className="mt-5 leading-7 text-muted-foreground">
          Your payment confirmation has been sent by email. The studio has been
          notified and will review your cake request and email you again with
          its decision.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          Return to the studio
        </Link>
      </section>
    </main>
  )
}
