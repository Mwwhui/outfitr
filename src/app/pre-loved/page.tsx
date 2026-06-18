'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
// Sub-components
import ActionCategoryCards, {
  ActionCategory,
} from '../components/pre-loved/ActionCategoryCards';
import DiyTutorials from '../components/pre-loved/DiyTutorials';
import PartnerDirectory, {
  Partner,
} from '../components/pre-loved/PartnerDirectory';
import PartnerDrawer, { ClothesItem } from '../components/pre-loved/PartnerDrawer';

const DynamicLeafletMap = dynamic(
  () => import('../components/pre-loved/LeafletMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-400">
        Loading map module...
      </div>
    ),
  },
);

function getDistanceInKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function PreLovedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeCategory, setActiveCategory] = useState<ActionCategory>(null);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'distance' | 'name'>('distance');

  // Data States
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [wardrobeItems, setWardrobeItems] = useState<ClothesItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLoc({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLoadingLocation(false);
        },
        () => {
          setUserLoc({ lat: 3.0061, lng: 101.6169 });
          setLoadingLocation(false);
        },
      );
    } else {
      setUserLoc({ lat: 3.0061, lng: 101.6169 });
      setLoadingLocation(false);
    }
  }, []);

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const res = await fetch('/api/partners');
        if (!res.ok) throw new Error('Failed to fetch partners');
        const data = await res.json();
        setPartners(data as Partner[]);
      } catch (error) {
        console.error('Error fetching partners:', error);
      } finally {
        setLoadingPartners(false);
      }
    };
    fetchPartners();
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    fetch(`/api/clothes?user_id=${session.user.id}`)
      .then(r => r.json())
      .then(data => setWardrobeItems(Array.isArray(data) ? data : []))
      .catch(err => console.error("Error fetching wardrobe items:", err))
      .finally(() => setLoadingItems(false));
  }, [status, session]);

  const handleConfirmPledge = useCallback(
    async (itemIds: string[], partnerId: string, actionType: string) => {
      const res = await fetch('/api/pledges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId, itemIds, actionType }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to submit pledge');
        return;
      }
      toast.success('Pledge submitted! Check your email for confirmation.');
    },
    [],
  );

  if (status === 'unauthenticated') {
    router.push('/auth/login');
    return null;
  }

  const filteredPartners = partners
    .filter((p) => {
      const matchesCategory =
        !activeCategory ||
        activeCategory === 'diy' ||
        p.type === activeCategory;
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    })
    .map((partner) => {
      if (userLoc) {
        const rawKm = getDistanceInKm(
          userLoc.lat,
          userLoc.lng,
          partner.lat,
          partner.lng,
        );
        return {
          ...partner,
          rawDistance: rawKm,
          distance: `${rawKm.toFixed(1)} km`,
        };
      }
      return { ...partner, rawDistance: 9999, distance: 'Calculating...' };
    })
    .filter((p) => !maxDistance || p.rawDistance <= maxDistance)
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return (a.rawDistance || 9999) - (b.rawDistance || 9999);
    });

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-[#163422]">Pre-Loved</h2>
        <p className="text-[#424843] mt-1">
          Give your unused items a second life.
        </p>
      </div>

      <div className="px-6 pb-16 max-w-7xl mx-auto space-y-8">
        <ActionCategoryCards
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
        />

        {activeCategory === 'diy' && <DiyTutorials />}

        {activeCategory !== 'diy' && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto lg:h-[580px]">
            <div className="lg:col-span-7 bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-200 relative min-h-[400px]">
              {!loadingLocation && !loadingPartners && userLoc ? (
                <DynamicLeafletMap
                  userLoc={userLoc}
                  filteredPartners={filteredPartners}
                  openDrawer={(p: Partner) => {
                    setSelectedPartner(p);
                    setDrawerOpen(true);
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#e8f5e9] to-[#e0f2f1] flex flex-col items-center justify-center text-gray-500 p-4">
                  <div className="text-4xl animate-bounce mb-2">📍</div>
                  <p className="text-sm font-medium">Loading Map Data...</p>
                </div>
              )}
            </div>

            <PartnerDirectory
              filteredPartners={filteredPartners}
              loadingPartners={loadingPartners}
              search={search}
              setSearch={setSearch}
              maxDistance={maxDistance}
              setMaxDistance={setMaxDistance}
              sortBy={sortBy}
              setSortBy={setSortBy}
              openDrawer={(p: Partner) => {
                setSelectedPartner(p);
                setDrawerOpen(true);
              }}
            />
          </section>
        )}
      </div>

      <PartnerDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        partner={selectedPartner}
        items={wardrobeItems}
        loading={loadingItems}
        onConfirm={handleConfirmPledge}
      />
    </div>
  );
}
