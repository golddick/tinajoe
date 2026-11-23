import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { dropid } from 'dropid'
import { db } from '@/lib/db'
import { authSchema } from '@/lib/db/schema'
import { getPendingAdminInvitation } from '@/lib/admin-invitations'
import { sendAdminOtp } from '@/lib/dropaphi'
import { hasStudioAdmin, isStudioAdmin } from '@/lib/studio-admin'

function getOrigin(value?: string) {
  if (!value) return undefined
  try {
    return new URL(value).origin
  } catch {
    return undefined
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
    camelCase: true,
  }),
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
    sendResetPassword: async ({ user }) => {
      if (await isStudioAdmin(user.id)) {
        await sendAdminOtp(user.email)
      }
    },
  },
  emailVerification: {
    sendOnSignUp: false,
    sendOnSignIn: true,
    sendVerificationEmail: async ({ user }) => {
      if (!(await hasStudioAdmin())) {
        await sendAdminOtp(user.email)
      }
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (newUser, context) => {
          if (!(await hasStudioAdmin())) return

          const inviteToken = context?.request?.headers.get(
            'x-studio-admin-invite',
          )
          const invitation = inviteToken
            ? await getPendingAdminInvitation(
                inviteToken,
                newUser.email,
                newUser.name,
              )
            : null
          if (!invitation) {
            throw new APIError('FORBIDDEN', {
              message:
                'Admin accounts can only be created from a valid studio invitation.',
            })
          }

          return { data: { ...newUser, emailVerified: true } }
        },
      },
    },
  },
  trustedOrigins: [
    ...(process.env.NODE_ENV === 'development'
      ? [
          'http://localhost:3000',
          ...[
            process.env.V0_RUNTIME_URL,
            process.env.V0_DEV_APP_URL,
            process.env.V0_BUILD_URL,
            process.env.V0_SANDBOX_URL,
          ].map(getOrigin).filter((origin): origin is string => Boolean(origin)),
        ]
      : []),
    ...(process.env.NODE_ENV === 'production'
      ? [
          ...[
            process.env.VERCEL_URL,
            process.env.VERCEL_PROJECT_PRODUCTION_URL,
          ]
            .map((host) => (host ? `https://${host}` : undefined))
            .map(getOrigin)
            .filter((origin): origin is string => Boolean(origin)),
        ]
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    database: {
      generateId: ({ model }) => dropid(model),
    },
    ...(process.env.NODE_ENV === 'development'
      ? {
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        }
      : {}),
  },
})
