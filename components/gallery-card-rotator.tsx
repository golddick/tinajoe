'use client'

import { useEffect, useState } from 'react'

export type PublicGalleryItem = {
  id: string
  title: string
  category: string
  image: string
}

function shuffled<T>(items: T[]) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

export function GalleryCardRotator({
  items,
}: {
  items: PublicGalleryItem[]
}) {
  const [visibleItems, setVisibleItems] = useState(items.slice(0, 4))

  useEffect(() => {
    if (items.length <= 1) return

    let order = shuffled(items)
    let offset = 0
    setVisibleItems(order.slice(0, 4))

    const interval = window.setInterval(() => {
      if (order.length <= 4) {
        setVisibleItems(shuffled(order))
        return
      }

      offset = (offset + 1) % order.length
      if (offset === 0) order = shuffled(items)
      setVisibleItems(
        shuffled(
          Array.from(
            { length: 4 },
            (_, index) => order[(offset + index) % order.length],
          ),
        ),
      )
    }, 5000)

    return () => window.clearInterval(interval)
  }, [items])

  return (
    <div className="grid flex-1 grid-cols-2 gap-3">
      {Array.from({ length: 4 }, (_, index) => {
        const item = visibleItems[index]
        return item ? (
          <figure
            key={`${item.id}-${index}`}
            className="relative aspect-square overflow-hidden rounded-2xl bg-muted"
          >
            <img
              src={item.image}
              alt={`${item.title} — ${item.category}`}
              loading="lazy"
              className="size-full object-cover"
            />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8 text-sm font-medium text-white">
              {item.title}
            </figcaption>
          </figure>
        ) : (
          <div
            key={`gallery-placeholder-${index}`}
            aria-hidden="true"
            className={`aspect-square rounded-2xl ${
              index % 3 === 0 ? 'bg-accent' : 'bg-muted'
            }`}
          />
        )
      })}
    </div>
  )
}
