import { redirect } from 'next/navigation'
import { AdminSignInForm } from '@/components/admin-sign-in-form'
import { getAdminSession } from '@/lib/admin-auth'

export const metadata = {
  title: 'Admin sign in — TinaJoe.studio',
  description: 'Secure access for the TinaJoe.studio bakery administrator.',
}

export default async function AdminSignInPage() {
  if (await getAdminSession()) {
    redirect('/admin')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/30 px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-sm sm:p-9">
        <a href="/" className="font-serif text-2xl tracking-tight">
          Tina<span className="text-accent">.</span>Joe
        </a>
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Studio Administrator
        </p>
        <h1 className="mt-2 font-serif text-3xl">Admin sign in</h1>
        {/* <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The first account to verify its email becomes the studio admin.
        </p> */}
        <AdminSignInForm />
      </section>
    </main>
  )
}
