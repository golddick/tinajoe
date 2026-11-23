'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export default function AdminInvitationForm({
  token,
  name,
  email,
}: {
  token: string
  name: string
  email: string
}) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      const signUp = await authClient.signUp.email({
        name,
        email,
        password,
        fetchOptions: {
          headers: { 'x-studio-admin-invite': token },
        },
      })
      if (signUp.error) {
        setError(
          signUp.error.message ||
            'We could not create your account. Check that the invitation is still valid.',
        )
        return
      }

      const response = await fetch('/api/admin/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(
          result.error ||
            'Your account was created, but the invitation could not be completed. Try again.',
        )
        return
      }

      const signIn = await authClient.signIn.email({ email, password })
      if (signIn.error) {
        router.replace('/admin/sign-in')
        return
      }
      router.replace('/admin')
      router.refresh()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'We could not complete your invitation. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5">
      <p className="text-sm leading-6 text-muted-foreground">
        You have been invited as a studio administrator. Confirm your details
        and create a password to activate your account.
      </p>
      <label className="block text-sm">
        Name
        <input
          readOnly
          value={name}
          className="mt-2 w-full rounded-xl border border-input bg-secondary px-3 py-3"
        />
      </label>
      <label className="block text-sm">
        Email address
        <input
          readOnly
          type="email"
          value={email}
          className="mt-2 w-full rounded-xl border border-input bg-secondary px-3 py-3"
        />
      </label>
      <label className="block text-sm">
        Create password
        <input
          autoComplete="new-password"
          type="password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
        />
      </label>
      <label className="block text-sm">
        Confirm password
        <input
          autoComplete="new-password"
          type="password"
          minLength={8}
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
        />
      </label>
      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground disabled:opacity-60"
      >
        {isSubmitting ? 'Setting up your account…' : 'Accept invitation'}
      </button>
    </form>
  )
}
