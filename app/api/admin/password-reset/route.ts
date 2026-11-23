import { and, desc, eq, gt, like } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { studioAdmin, user, verification } from '@/lib/db/schema'
import { verifyAdminOtp } from '@/lib/dropaphi'

type PasswordResetRequest = {
  action?: unknown
  email?: unknown
  code?: unknown
  newPassword?: unknown
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request) {
  let payload: PasswordResetRequest
  try {
    payload = (await request.json()) as PasswordResetRequest
  } catch {
    return jsonError('Invalid request.', 400)
  }

  const email =
    typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError('Enter a valid email address.', 400)
  }

  if (payload.action === 'request') {
    try {
      await auth.api.requestPasswordReset({
        body: { email },
        headers: request.headers,
      })
      return NextResponse.json({
        ok: true,
        message: 'If this is the studio admin email, a verification code has been sent.',
      })
    } catch (error) {
      console.error('Password reset request failed:', error)
      return jsonError(
        'Password reset is temporarily unavailable. Please try again.',
        502,
      )
    }
  }

  if (payload.action !== 'reset') {
    return jsonError('Invalid request.', 400)
  }

  const code = typeof payload.code === 'string' ? payload.code.trim() : ''
  const newPassword =
    typeof payload.newPassword === 'string' ? payload.newPassword : ''
  if (!/^\d{6}$/.test(code)) {
    return jsonError('Enter the six-digit verification code.', 400)
  }
  if (newPassword.length < 8 || newPassword.length > 128) {
    return jsonError('Choose a password between 8 and 128 characters.', 400)
  }

  try {
    const [admin] = await db
      .select({ id: user.id })
      .from(user)
      .innerJoin(studioAdmin, eq(studioAdmin.userId, user.id))
      .where(eq(user.email, email))
      .limit(1)

    if (!admin) {
      return jsonError(
        'The code is invalid or has expired. Request a new code and try again.',
        400,
      )
    }

    const [resetToken] = await db
      .select({ identifier: verification.identifier })
      .from(verification)
      .where(
        and(
          eq(verification.value, admin.id),
          like(verification.identifier, 'reset-password:%'),
          gt(verification.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(verification.createdAt))
      .limit(1)

    if (!resetToken) {
      return jsonError(
        'The code is invalid or has expired. Request a new code and try again.',
        400,
      )
    }

    if (!(await verifyAdminOtp(email, code))) {
      return jsonError(
        'The code is invalid or has expired. Request a new code and try again.',
        400,
      )
    }

    const token = resetToken.identifier.slice('reset-password:'.length)
    await auth.api.resetPassword({
      body: { token, newPassword },
    })

    return NextResponse.json({
      ok: true,
      message: 'Password updated. You can now sign in with your new password.',
    })
  } catch (error) {
    console.error('Password reset failed:', error)
    return jsonError(
      'Password reset is temporarily unavailable. Please try again.',
      502,
    )
  }
}
