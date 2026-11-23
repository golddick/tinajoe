'use client'

import { useEffect } from 'react'
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'

type MapPoint = [number, number]

function MapCenter({ center }: { center: MapPoint }) {
  const map = useMap()

  useEffect(() => {
    map.setView(center)
  }, [center, map])

  return null
}

function MapClickHandler({
  onPick,
}: {
  onPick: (point: MapPoint) => void
}) {
  useMapEvents({
    click(event) {
      onPick([event.latlng.lat, event.latlng.lng])
    },
  })

  return null
}

export function LeafletAddressMap({
  center,
  marker,
  onPick,
}: {
  center: MapPoint
  marker: MapPoint | null
  onPick: (point: MapPoint) => void
}) {
  return (
    <MapContainer
      center={center}
      zoom={15}
      scrollWheelZoom
      className="h-80 w-full rounded-xl"
    >
      <MapCenter center={center} />
      <MapClickHandler onPick={onPick} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {marker ? (
        <CircleMarker
          center={marker}
          radius={9}
          pathOptions={{
            color: '#ffffff',
            fillColor: '#9f3f32',
            fillOpacity: 1,
            weight: 3,
          }}
        />
      ) : null}
    </MapContainer>
  )
}
