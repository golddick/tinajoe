'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

type Screen = 'sign-in' | 'sign-up' | 'verify'

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (
    error instanceof TypeError ||
    (error instanceof Error && error.message === 'Failed to fetch')
  ) {
    return 'We could not connect to the sign-in service, so your password was not checked. Check your internet connection and try again. If this continues, the service may be temporarily unavailable; contact the studio administrator.'
  }

  return error instanceof Error ? error.message : fallback
}

export function AdminSignInForm() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('sign-in')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function sendOtp() {
    const response = await fetch('/api/admin/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', email }),
    })
    const result = (await response.json()) as { error?: string }
    if (!response.ok) {
      throw new Error(result.error || 'We could not send a verification code.')
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSubmitting(true)

    try {
      const normalizedEmail = email.trim().toLowerCase()

      if (screen === 'sign-up') {
        const result = await authClient.signUp.email({
          name: name.trim(),
          email: normalizedEmail,
          password,
        })

        if (result.error) {
          setError(
            'We could not create the admin account. The first admin may already be set up, or the details may be invalid.',
          )
          return
        }

        setEmail(normalizedEmail)
        setScreen('verify')
        await sendOtp()
        setMessage(`A six-digit verification code was sent to ${normalizedEmail}.`)
        return
      }

      if (screen === 'verify') {
        const response = await fetch('/api/admin/otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'verify',
            email: normalizedEmail,
            code,
          }),
        })
        const result = (await response.json()) as { error?: string }

        if (!response.ok) {
          setError(result.error || 'We could not verify that code.')
          return
        }

        setScreen('sign-in')
        setCode('')
        setPassword('')
        setMessage('Email verified. Sign in with your email and password.')
        return
      }

      const result = await authClient.signIn.email({
        email: normalizedEmail,
        password,
      })

      if (result.error) {
        setError('We could not authenticate those details. Check your password and verify your email if this is a new account.')
        return
      }

      router.replace('/admin')
      router.refresh()
    } catch (submitError) {
      setError(
        getRequestErrorMessage(
          submitError,
          'We could not complete that request. Please try again.',
        ),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function resendCode() {
    setError('')
    setMessage('')
    setIsSubmitting(true)
    try {
      await sendOtp()
      setMessage(`A new verification code was sent to ${email}.`)
    } catch (sendError) {
      setError(
        getRequestErrorMessage(
          sendError,
          'We could not send a verification code. Please try again.',
        ),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      {screen === 'sign-up' ? (
        <label className="block text-sm">
          Name
          <input
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
          />
        </label>
      ) : null}
      {screen !== 'verify' ? (
        <>
          <label className="block text-sm">
            Admin email
            <input
              autoComplete="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
            />
          </label>
          <div className="block text-sm">
            <label htmlFor="admin-password">Password</label>
            <span className="relative mt-2 block">
              <input
                id="admin-password"
                autoComplete={screen === 'sign-in' ? 'current-password' : 'new-password'}
                type={isPasswordVisible ? 'text' : 'password'}
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-3 pr-12"
              />
              <button
                type="button"
                onClick={() => setIsPasswordVisible((visible) => !visible)}
                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                aria-pressed={isPasswordVisible}
                aria-controls="admin-password"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              >
                {isPasswordVisible ? (
                  <EyeOff aria-hidden="true" size={18} />
                ) : (
                  <Eye aria-hidden="true" size={18} />
                )}
              </button>
            </span>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm leading-6 text-muted-foreground">
            Enter the six-digit code sent to <strong>{email}</strong>. After
            verification, sign in with your email and password.
          </p>
          <label className="block text-sm">
            Verification code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3 tracking-[0.3em]"
            />
          </label>
        </>
      )}
      {message ? (
        <p role="status" className="rounded-xl bg-secondary p-3 text-sm">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {isSubmitting
          ? 'Please wait…'
          : screen === 'sign-in'
            ? 'Sign in'
            : screen === 'sign-up'
              ? 'Create admin account'
              : 'Verify email'}
      </button>
      {screen === 'verify' ? (
        <>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={resendCode}
            className="w-full text-sm text-muted-foreground underline underline-offset-4 disabled:opacity-60"
          >
            Resend verification code
          </button>
          <button
            type="button"
            onClick={() => {
              setScreen('sign-in')
              setError('')
              setMessage('')
            }}
            className="w-full text-sm text-muted-foreground underline underline-offset-4"
          >
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              setScreen(screen === 'sign-in' ? 'sign-up' : 'sign-in')
              setError('')
              setMessage('')
            }}
            className="w-full text-sm text-muted-foreground underline underline-offset-4"
          >
            {screen === 'sign-in'
              ? 'First time here? Set up the first admin account.'
              : 'Already have an account? Sign in.'}
          </button>
          <div className="w-full flex flex-row items-center justify-between gap-2">
              {screen === 'sign-in' ? (
            <Link
              href="/admin/forgot-password"
              className="block w-full text-center text-sm text-muted-foreground underline underline-offset-4"
            >
              Forgot password?
            </Link>
          ) : null}
          {screen === 'sign-in' ? (
            <button
              type="button"
              onClick={() => {
                setScreen('verify')
                setError('')
                setMessage('')
              }}
              className="w-full text-sm text-muted-foreground underline underline-offset-4"
            >
              Verify your email
            </button>
          ) : null}
          </div>
        </>
      )}
      {/* <p className="text-center text-xs leading-5 text-muted-foreground">
        Admin account creation is restricted to the studio email configured by
        the owner.
      </p> */}
    </form>
  )
}
