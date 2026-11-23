'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'

type Screen = 'request' | 'reset' | 'complete'

type PasswordResetResponse = {
  error?: string
  message?: string
}

export function AdminPasswordResetForm() {
  const [screen, setScreen] = useState<Screen>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (screen === 'reset' && password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/admin/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          screen === 'request'
            ? { action: 'request', email }
            : { action: 'reset', email, code, newPassword: password },
        ),
      })
      const result = (await response.json()) as PasswordResetResponse

      if (!response.ok) {
        setError(result.error || 'We could not complete the password reset.')
        return
      }

      if (screen === 'request') {
        setScreen('reset')
        setMessage(
          result.message ||
            'If this is the studio admin email, a verification code has been sent.',
        )
      } else {
        setScreen('complete')
        setMessage(
          result.message || 'Password updated. You can now sign in.',
        )
      }
    } catch {
      setError('We could not reach the server. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function resendCode() {
    setError('')
    setMessage('')
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/admin/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email }),
      })
      const result = (await response.json()) as PasswordResetResponse
      if (!response.ok) {
        setError(result.error || 'We could not send a new verification code.')
        return
      }
      setMessage(
        result.message ||
          'If this is the studio admin email, a verification code has been sent.',
      )
    } catch {
      setError('We could not reach the server. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      {screen !== 'complete' ? (
        <label className="block text-sm">
          Admin email
          <input
            autoComplete="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            readOnly={screen === 'reset'}
            className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3 read-only:opacity-70"
          />
        </label>
      ) : null}

      {screen === 'reset' ? (
        <>
          <label className="block text-sm">
            Verification code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, ''))
              }
              className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3 tracking-[0.3em]"
            />
          </label>
          <label className="block text-sm">
            New password
            <input
              autoComplete="new-password"
              type="password"
              minLength={8}
              maxLength={128}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
            />
          </label>
          <label className="block text-sm">
            Confirm new password
            <input
              autoComplete="new-password"
              type="password"
              minLength={8}
              maxLength={128}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
            />
          </label>
        </>
      ) : null}

      {message ? (
        <p role="status" className="rounded-xl bg-secondary p-3 text-sm">
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {screen !== 'complete' ? (
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {isSubmitting
            ? 'Please wait…'
            : screen === 'request'
              ? 'Send verification code'
              : 'Reset password'}
        </button>
      ) : null}

      {screen === 'reset' ? (
        <button
          type="button"
          disabled={isSubmitting}
          onClick={resendCode}
          className="w-full text-sm text-muted-foreground underline underline-offset-4 disabled:opacity-60"
        >
          Resend verification code
        </button>
      ) : null}

      <Link
        href="/admin/sign-in"
        className="block w-full text-center text-sm text-muted-foreground underline underline-offset-4"
      >
        {screen === 'complete' ? 'Return to sign in' : 'Back to sign in'}
      </Link>
    </form>
  )
}
