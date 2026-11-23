'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

export function AdminSignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function signOut() {
    setIsSigningOut(true)
    await authClient.signOut()
    window.location.assign('/admin/sign-in')
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={isSigningOut}
      className="rounded-full border border-border px-4 py-2 text-sm hover:bg-secondary disabled:opacity-60"
    >
      {isSigningOut ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
