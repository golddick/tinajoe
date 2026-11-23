import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { isStudioAdmin } from '@/lib/studio-admin'

export async function getAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (
    !session?.user ||
    !(await isStudioAdmin(session.user.id)) ||
    !session.user.emailVerified
  ) {
    return null
  }

  return session
}

export async function requireAdmin() {
  const session = await getAdminSession()

  if (!session) {
    throw new Error('Unauthorized')
  }

  return session
}
