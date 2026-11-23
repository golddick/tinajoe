import { and, eq, gt, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { adminInvitations, studioAdmin, user } from '@/lib/db/schema'
import { hashAdminInvitationToken } from '@/lib/admin-invitations'

export async function POST(request: Request) {
  let payload: { token?: unknown }
  try {
    payload = (await request.json()) as { token?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const token = typeof payload.token === 'string' ? payload.token : ''
  if (!token || token.length > 200) {
    return NextResponse.json({ error: 'Invalid invitation.' }, { status: 400 })
  }

  const tokenHash = hashAdminInvitationToken(token)
  const [invitation] = await db
    .select()
    .from(adminInvitations)
    .where(eq(adminInvitations.tokenHash, tokenHash))
    .limit(1)

  if (!invitation) {
    return NextResponse.json(
      { error: 'This invitation is invalid or has expired.' },
      { status: 404 },
    )
  }

  if (invitation.acceptedAt) {
    return NextResponse.json(
      { error: 'This invitation has already been accepted.' },
      { status: 409 },
    )
  }
  if (invitation.expiresAt <= new Date()) {
    return NextResponse.json(
      { error: 'This invitation has expired. Ask for a new invitation.' },
      { status: 410 },
    )
  }

  const [invitedUser] = await db
    .select({
      id: user.id,
      emailVerified: user.emailVerified,
    })
    .from(user)
    .where(
      and(
        eq(user.email, invitation.email),
        eq(user.name, invitation.name),
        eq(user.emailVerified, true),
      ),
    )
    .limit(1)

  if (!invitedUser) {
    return NextResponse.json(
      {
        error:
          'Create your account with the invited name and email before accepting this invitation.',
      },
      { status: 409 },
    )
  }

  const accepted = await db.transaction(async (transaction) => {
    const [lockedInvitation] = await transaction
      .select({ id: adminInvitations.id })
      .from(adminInvitations)
      .where(
        and(
          eq(adminInvitations.id, invitation.id),
          gt(adminInvitations.expiresAt, new Date()),
          isNull(adminInvitations.acceptedAt),
        ),
      )
      .for('update')
      .limit(1)
    if (!lockedInvitation) return false

    await transaction
      .insert(studioAdmin)
      .values({ id: `admin:${invitedUser.id}`, userId: invitedUser.id })
      .onConflictDoNothing()

    const [updatedInvitation] = await transaction
      .update(adminInvitations)
      .set({
        acceptedAt: new Date(),
        acceptedUserId: invitedUser.id,
      })
      .where(eq(adminInvitations.id, invitation.id))
      .returning({ id: adminInvitations.id })

    return Boolean(updatedInvitation)
  })

  if (!accepted) {
    return NextResponse.json(
      { error: 'This invitation was already accepted or has expired.' },
      { status: 409 },
    )
  }

  return NextResponse.json({ ok: true })
}
