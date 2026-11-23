import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { studioAdmin } from '@/lib/db/schema'

export async function hasStudioAdmin() {
  const [admin] = await db
    .select({ id: studioAdmin.id })
    .from(studioAdmin)
    .limit(1)

  return Boolean(admin)
}

export async function isStudioAdmin(userId: string) {
  const [admin] = await db
    .select({ id: studioAdmin.id })
    .from(studioAdmin)
    .where(eq(studioAdmin.userId, userId))
    .limit(1)

  return Boolean(admin)
}
