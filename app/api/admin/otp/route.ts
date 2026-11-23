import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { studioAdmin, user } from '@/lib/db/schema'
import { sendAdminOtp, verifyAdminOtp } from '@/lib/dropaphi'

type OtpRequest = {
  action?: unknown
  email?: unknown
  code?: unknown
}

export async function POST(request: Request) {
  let payload: OtpRequest
  try {
    payload = (await request.json()) as OtpRequest
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const email =
    typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  if (!email) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  try {
    const [existingAdmin] = await db
      .select({ id: studioAdmin.id })
      .from(studioAdmin)
      .limit(1)

    if (existingAdmin) {
      return NextResponse.json(
        { error: 'The first admin account has already been verified.' },
        { status: 403 },
      )
    }

    const [pendingUser] = await db
      .select({ id: user.id, emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.email, email))
      .limit(1)

    if (!pendingUser || pendingUser.emailVerified) {
      return NextResponse.json(
        { error: 'Create an unverified account before requesting verification.' },
        { status: 404 },
      )
    }

    if (payload.action === 'send') {
      await sendAdminOtp(email)
      return NextResponse.json({ ok: true })
    }

    if (payload.action === 'verify') {
      const code = typeof payload.code === 'string' ? payload.code.trim() : ''
      if (!/^\d{6}$/.test(code)) {
        return NextResponse.json(
          { error: 'Enter the six-digit code from your email.' },
          { status: 400 },
        )
      }

      const verified = await verifyAdminOtp(email, code)
      if (!verified) {
        return NextResponse.json(
          { error: 'That code is not valid. Check it and try again.' },
          { status: 400 },
        )
      }

      const claimResult = await db.transaction(async (tx) => {
        const [verifiedUser] = await tx
          .update(user)
          .set({ emailVerified: true, updatedAt: new Date() })
          .where(eq(user.id, pendingUser.id))
          .returning({ id: user.id })

        if (!verifiedUser) return 'missing-user'

        const [admin] = await tx
          .insert(studioAdmin)
          .values({ id: 'primary', userId: verifiedUser.id })
          .onConflictDoNothing()
          .returning({ id: studioAdmin.id })

        return admin ? 'claimed' : 'already-claimed'
      })

      if (claimResult !== 'claimed') {
        return NextResponse.json(
          {
            error:
              claimResult === 'missing-user'
                ? 'Create your account before verifying your email.'
                : 'Another account has already completed first-admin verification.',
          },
          { status: claimResult === 'missing-user' ? 404 : 409 },
        )
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  } catch (error) {
    console.error('Admin OTP request failed:', error)
    return NextResponse.json(
      { error: 'Email verification is temporarily unavailable. Try again.' },
      { status: 502 },
    )
  }
}
