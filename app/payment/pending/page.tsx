import Link from 'next/link'

export default function PaymentPendingPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-16 text-foreground">
      <section className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 text-center shadow-sm md:p-12">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Payment status pending
        </p>
        <h1 className="mt-4 font-serif text-4xl">
          We&apos;re checking your payment.
        </h1>
        <p className="mt-5 leading-7 text-muted-foreground">
          We could not finish confirming the payment on this page. Please do
          not submit another payment yet. Check your Paystack or bank account;
          if you were charged, the studio will reconcile the payment and email
          you. Contact the studio if you need help.
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
