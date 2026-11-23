import Link from 'next/link'
import { getPendingAdminInvitation } from '@/lib/admin-invitations'
import AdminInvitationForm from '@/components/admin-invitation-form'

export const metadata = {
  title: 'Accept admin invitation — TinaJoe.studio',
  description: 'Set up your invited TinaJoe.studio administrator account.',
}

export default async function AcceptAdminInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const invitationToken =
    typeof token === 'string' && token.length <= 200 ? token : null
  const invitation = invitationToken
    ? await getPendingAdminInvitation(invitationToken)
    : null

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/30 px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-sm sm:p-9">
        <Link href="/" className="font-serif text-2xl tracking-tight">
          Tina<span className="text-accent">.</span>Joe
        </Link>
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Studio administrator
        </p>
        <h1 className="mt-2 font-serif text-3xl">Accept your invitation</h1>
        {invitation && invitationToken ? (
          <AdminInvitationForm
            token={invitationToken}
            name={invitation.name}
            email={invitation.email}
          />
        ) : (
          <div className="mt-6 space-y-4">
            <p role="alert" className="text-sm leading-6 text-destructive">
              This invitation is invalid, expired, or has already been accepted.
              Ask a studio administrator to send you a new invitation.
            </p>
            <Link
              href="/admin/sign-in"
              className="inline-flex rounded-full border border-border px-4 py-2 text-sm hover:bg-secondary"
            >
              Return to admin sign in
            </Link>
          </div>
        )}
      </section>
    </main>
  )
}
