'use client';

import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import 'leaflet/dist/leaflet.css';

const PIN_BASE =
  'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/';

function coloredIcon(color: string) {
  return new L.Icon({
    iconUrl: `${PIN_BASE}marker-icon-${color}.png`,
    iconRetinaUrl: `${PIN_BASE}marker-icon-2x-${color}.png`,
    shadowUrl: `${PIN_BASE}marker-shadow.png`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    shadowSize: [41, 41],
    shadowAnchor: [13, 41],
    popupAnchor: [0, -41],
  });
}

const userIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:30px;height:30px;
    background:white;
    border:2.5px solid #2563eb;
    border-radius:50%;
    display:flex;
    align-items:center;
    justify-content:center;
    box-shadow:0 2px 6px rgba(0,0,0,0.3);
    font-size:18px;
  ">👤</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});
const partnerIcons: Record<string, L.Icon> = {
  donate: coloredIcon('orange'),
  sell: coloredIcon('blue'),
  recycle: coloredIcon('green'),
};

interface LeafletMapProps {
  userLoc: { lat: number; lng: number } | null;
  filteredPartners: any[];
  openDrawer: (partner: any) => void;
}

function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        map.setView(center, 12);
      } catch {
        // map not ready yet
      }
    }, 50);
    return () => clearTimeout(timer);
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

      {userLoc && (
        <Marker position={[userLoc.lat, userLoc.lng]} icon={userIcon} />
      )}

      {filteredPartners.map((partner) => (
        <Marker
          key={partner.id}
          position={[partner.lat, partner.lng]}
          icon={partnerIcons[partner.type]}
          eventHandlers={{
            click: () => openDrawer(partner),
          }}
        />
      ))}
    </MapContainer>
  );
}
