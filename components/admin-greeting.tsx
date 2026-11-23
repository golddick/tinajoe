'use client'

import { useEffect, useState } from 'react'

function getGreeting(hour: number) {
  if (hour < 5 || hour >= 21) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function AdminGreeting({ name }: { name: string }) {
  const [greeting, setGreeting] = useState('Hello')

  useEffect(() => {
    const updateGreeting = () => setGreeting(getGreeting(new Date().getHours()))
    updateGreeting()

    const interval = window.setInterval(updateGreeting, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  return <span className="capitalize">{greeting}, {name}</span>
}
