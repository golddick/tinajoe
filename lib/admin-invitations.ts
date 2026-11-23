import { createHash } from 'node:crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { adminInvitations } from '@/lib/db/schema'

export function hashAdminInvitationToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function getPendingAdminInvitation(
  token: string,
  email?: string,
  name?: string,
) {
  const conditions = [
    eq(adminInvitations.tokenHash, hashAdminInvitationToken(token)),
    gt(adminInvitations.expiresAt, new Date()),
    isNull(adminInvitations.acceptedAt),
  ]
  if (email !== undefined) {
    conditions.push(eq(adminInvitations.email, email.trim().toLowerCase()))
  }
  if (name !== undefined) {
    conditions.push(eq(adminInvitations.name, name.trim()))
  }

  const [invitation] = await db
    .select({
      id: adminInvitations.id,
      name: adminInvitations.name,
      email: adminInvitations.email,
      expiresAt: adminInvitations.expiresAt,
    })
    .from(adminInvitations)
    .where(and(...conditions))
    .limit(1)

  return invitation ?? null
}
