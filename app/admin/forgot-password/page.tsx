import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AdminPasswordResetForm } from '@/components/admin-password-reset-form'
import { getAdminSession } from '@/lib/admin-auth'

export const metadata = {
  title: 'Reset password — Tina.Joe.studio',
  description: 'Reset the studio administrator password.',
}

export default async function ForgotPasswordPage() {
  if (await getAdminSession()) {
    redirect('/admin')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/30 px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-sm sm:p-9">
        <Link href="/" className="font-serif text-2xl tracking-tight">
          Tina.Joe<span className="text-accent">.</span>studio
        </Link>
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Studio Administrator
        </p>
        <h1 className="mt-2 font-serif text-3xl">Reset your password</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Request a six-digit code for the studio admin email, then choose a
          new password.
        </p>
        <AdminPasswordResetForm />
      </section>
    </main>
  )
}
