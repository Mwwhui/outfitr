'use client';

import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
// @ts-ignore: side-effect import for Leaflet CSS without type declarations
import 'leaflet/dist/leaflet.css';

const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface LeafletMapProps {
  userLoc: { lat: number; lng: number } | null;
  filteredPartners: any[];
  openDrawer: (partner: any) => void;
}

// Automatically fly the map when the user's location is found
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 12);
  }, [center, map]);
  return null;
}

export default function LeafletMap({
  userLoc,
  filteredPartners,
  openDrawer,
}: LeafletMapProps) {
  const defaultCenter: [number, number] = userLoc
    ? [userLoc.lat, userLoc.lng]
    : [3.0061, 101.6169];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={12}
      className="w-full h-full z-0"
    >
      <MapRecenter center={defaultCenter} />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Blue user location dot */}
      {userLoc && (
        <Marker position={[userLoc.lat, userLoc.lng]} icon={customIcon} />
      )}

      {/* Partner */}
      {filteredPartners.map((partner) => (
        <Marker
          key={partner.id}
          position={[partner.lat, partner.lng]}
          icon={customIcon}
          eventHandlers={{
            click: () => openDrawer(partner),
          }}
        />
      ))}
    </MapContainer>
  );
}
