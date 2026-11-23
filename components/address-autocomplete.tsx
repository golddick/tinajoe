'use client'

import dynamic from 'next/dynamic'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { AddressSuggestion } from '@/lib/address-suggestions'

const LeafletAddressMap = dynamic(
  () =>
    import('@/components/leaflet-address-map').then(
      (module) => module.LeafletAddressMap,
    ),
  { ssr: false },
)

type SuggestionsResponse = {
  suggestions?: AddressSuggestion[]
  error?: string
}

type ReverseResponse = {
  suggestion?: AddressSuggestion
  error?: string
}

const DEFAULT_MAP_CENTER: [number, number] = [51.5072, -0.1276]

export function AddressAutocomplete({
  id: suppliedId,
  value,
  onChange,
  onSelect,
  placeholder,
  required = false,
  rows = 1,
  multiline = false,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  onSelect: (suggestion: AddressSuggestion) => void
  placeholder?: string
  required?: boolean
  rows?: number
  multiline?: boolean
}) {
  const generatedId = useId()
  const id = suppliedId ?? generatedId
  const wrapperRef = useRef<HTMLDivElement>(null)
  const reverseRequestRef = useRef<AbortController | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [mapPoint, setMapPoint] = useState<[number, number] | null>(null)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [locationMessage, setLocationMessage] = useState('')
  const [isResolvingPoint, setIsResolvingPoint] = useState(false)
  const [mapError, setMapError] = useState('')

  const mapCenter = useMemo<[number, number]>(() => {
    if (mapPoint) return mapPoint
    if (userLocation) return userLocation
    const firstLocatedSuggestion = suggestions.find(
      (suggestion) =>
        Number.isFinite(suggestion.latitude) &&
        Number.isFinite(suggestion.longitude),
    )
    if (
      firstLocatedSuggestion?.latitude !== undefined &&
      firstLocatedSuggestion.longitude !== undefined
    ) {
      return [firstLocatedSuggestion.latitude, firstLocatedSuggestion.longitude]
    }
    return DEFAULT_MAP_CENTER
  }, [mapPoint, suggestions, userLocation])

  const resolveMapPoint = async (point: [number, number]) => {
    reverseRequestRef.current?.abort()
    const controller = new AbortController()
    reverseRequestRef.current = controller
    setMapPoint(point)
    setMapError('')
    setIsResolvingPoint(true)
    try {
      const response = await fetch(
        `/api/address-reverse?lat=${point[0]}&lon=${point[1]}`,
        { signal: controller.signal },
      )
      const result = (await response.json()) as ReverseResponse
      if (!response.ok || !result.suggestion) {
        throw new Error(result.error || 'Could not find an address at that point.')
      }
      onSelect({
        ...result.suggestion,
        latitude: point[0],
        longitude: point[1],
      })
      setSuggestions([])
      setHasSearched(false)
    } catch (error) {
      if (!controller.signal.aborted) {
        setMapError(
          error instanceof Error
            ? error.message
            : 'Address lookup is temporarily unavailable. Try again.',
        )
      }
    } finally {
      if (reverseRequestRef.current === controller) {
        reverseRequestRef.current = null
        setIsResolvingPoint(false)
      }
    }
  }

  useEffect(
    () => () => {
      reverseRequestRef.current?.abort()
    },
    [],
  )

  const handleChange = (nextValue: string) => {
    reverseRequestRef.current?.abort()
    reverseRequestRef.current = null
    setIsResolvingPoint(false)
    setMapPoint(null)
    setUserLocation(null)
    setLocationMessage('')
    setMapError('')
    onChange(nextValue)
  }

  const openMap = () => {
    setIsMapOpen(true)
    setIsFocused(false)
    setSuggestions([])
    setHasSearched(false)
    setMapPoint(null)
    setUserLocation(null)
    setMapError('')
    setLocationMessage('')

    if (!navigator.geolocation) {
      setLocationMessage(
        'Your browser does not support location access. Showing the default map area.',
      )
      return
    }

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation([coords.latitude, coords.longitude])
        setIsLocating(false)
        setLocationMessage('Map centered near your location.')
      },
      (error) => {
        setLocationMessage(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. Allow location access in your browser to center the map near you.'
            : 'Your location could not be found. Showing the default map area.',
        )
        setIsLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  useEffect(() => {
    const query = value.trim()
    setSuggestions([])
    setHasSearched(false)
    setSearchError('')

    if (!isFocused || query.length < 3) {
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/address-suggestions?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        )
        const result = (await response.json()) as SuggestionsResponse
        if (!response.ok) {
          throw new Error(result.error || 'Address search is temporarily unavailable.')
        }
        setSuggestions(result.suggestions ?? [])
        setHasSearched(true)
      } catch (error) {
        if (!controller.signal.aborted) {
          setSearchError(
            error instanceof Error
              ? error.message
              : 'Address search is temporarily unavailable.',
          )
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, 450)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [isFocused, value])

  useEffect(() => {
    function dismissOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !wrapperRef.current?.contains(event.target)
      ) {
        setIsFocused(false)
      }
    }

    document.addEventListener('pointerdown', dismissOutside)
    return () => document.removeEventListener('pointerdown', dismissOutside)
  }, [])

  const inputClassName =
    'mt-2 w-full rounded-xl border border-input bg-background px-3 py-3'
  const listIsOpen = Boolean(
    isFocused &&
    value.trim().length >= 3 &&
    (isLoading || searchError || hasSearched),
  )

  return (
    <div ref={wrapperRef} className="relative">
      {multiline ? (
        <textarea
          id={id}
          value={value}
          required={required}
          onFocus={() => setIsFocused(true)}
          onChange={(event) => handleChange(event.target.value)}
          autoComplete="street-address"
          rows={rows}
          className={inputClassName}
          placeholder={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={listIsOpen}
          aria-controls={`${id}-suggestions`}
        />
      ) : (
        <input
          id={id}
          value={value}
          required={required}
          onFocus={() => setIsFocused(true)}
          onChange={(event) => handleChange(event.target.value)}
          autoComplete="street-address"
          className={inputClassName}
          placeholder={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={listIsOpen}
          aria-controls={`${id}-suggestions`}
        />
      )}
      {listIsOpen ? (
        <div
          id={`${id}-suggestions`}
          role="listbox"
          aria-label="Address suggestions"
          className="absolute z-[1000] mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-card p-1 shadow-xl"
        >
          {isLoading ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Searching addresses…
            </p>
          ) : searchError ? (
            <p role="status" className="px-3 py-2 text-sm text-destructive">
              {searchError}
            </p>
          ) : suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.label}-${index}`}
                type="button"
                role="option"
                aria-selected="false"
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  reverseRequestRef.current?.abort()
                  reverseRequestRef.current = null
                  setIsResolvingPoint(false)
                  onSelect(suggestion)
                  if (
                    suggestion.latitude !== undefined &&
                    suggestion.longitude !== undefined
                  ) {
                    setMapPoint([suggestion.latitude, suggestion.longitude])
                  }
                  setSuggestions([])
                  setIsFocused(false)
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
              >
                {suggestion.label}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No matching addresses found.
            </p>
          )}
        </div>
      ) : null}
      <button
        type="button"
        aria-expanded={isMapOpen}
        onClick={() => {
          if (isMapOpen) {
            setIsMapOpen(false)
            setIsLocating(false)
          } else {
            openMap()
          }
        }}
        className="mt-2 text-sm font-medium text-primary underline underline-offset-2"
      >
        {isMapOpen ? 'Close map' : 'Choose on map'}
      </button>
      {isMapOpen ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-border">
          {isLocating ? (
            <p
              role="status"
              className="grid h-80 place-items-center bg-secondary px-4 text-sm text-muted-foreground"
            >
              Finding your location…
            </p>
          ) : (
            <LeafletAddressMap
              center={mapCenter}
              marker={mapPoint}
              onPick={resolveMapPoint}
            />
          )}
          {locationMessage ? (
            <p role="status" className="bg-card px-3 py-2 text-xs text-muted-foreground">
              {locationMessage}
            </p>
          ) : null}
          {!isLocating ? (
            <p aria-live="polite" className="bg-card px-3 py-2 text-xs text-muted-foreground">
              {isResolvingPoint
                ? 'Finding the address…'
                : 'Tap or click the map to place the pin. The address will be looked up automatically.'}
            </p>
          ) : null}
          {mapError ? (
            <p role="alert" className="bg-card px-3 pb-3 text-sm text-destructive">
              {mapError}
            </p>
          ) : null}
        </div>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">
        Search suggestions by Photon. Map tiles © OpenStreetMap contributors.
      </p>
    </div>
  )
}
