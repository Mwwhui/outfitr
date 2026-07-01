'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { recommendDisposal, countRecommendations, DisposalMethod } from '@/lib/disposalRecommender';

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

  // Pending action items (from duplicate comparison)
  const [pendingItems, setPendingItems] = useState<ClothesItem[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [showPendingSection, setShowPendingSection] = useState(false);
  const [pendingActionType, setPendingActionType] = useState<DisposalMethod | null>(null);

  const recommendations = useMemo(() => {
    const map: Record<string, ReturnType<typeof recommendDisposal>> = {};
    for (const item of wardrobeItems) {
      map[item.id] = recommendDisposal(item);
    }
    return map;
  }, [wardrobeItems]);

  const recCounts = useMemo(() => countRecommendations(wardrobeItems), [wardrobeItems]);

  const pendingRecommendations = useMemo(() => {
    const map: Record<string, ReturnType<typeof recommendDisposal>> = {};
    for (const item of pendingItems) {
      map[item.id] = recommendDisposal(item);
    }
    return map;
  }, [pendingItems]);

  const handlePendingActionSelect = (action: DisposalMethod) => {
    setPendingActionType(action);
    setShowPendingSection(true);
    // Also set the active category to filter partners
    setActiveCategory(action);
  };

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
      .then(data => {
        if (Array.isArray(data)) {
          const pending: ClothesItem[] = [];
          const wardrobe: ClothesItem[] = [];
          for (const item of data) {
            if ((item as Record<string, unknown>).status === 'pending_action') {
              pending.push(item);
            } else {
              wardrobe.push(item);
            }
          }
          setWardrobeItems(wardrobe);
          setPendingItems(pending);
        }
      })
      .catch(err => console.error("Error fetching wardrobe items:", err))
      .finally(() => { setLoadingItems(false); setLoadingPending(false); });
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
      // Remove pledged items from pending list
      setPendingItems((prev) => prev.filter((item) => !itemIds.includes(item.id)));
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
    <div className="min-h-screen">
      <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-[#163422] font-headline">Pre-Loved</h2>
        <p className="text-[#424843] mt-1">
          Give your unused items a second life.
        </p>
      </div>

      <div className="px-6 pb-16 max-w-7xl mx-auto space-y-8">
        <ActionCategoryCards
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
        />

        {activeCategory !== 'diy' && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-[#163422] mr-1">Smart insights:</p>
            {pendingItems.length > 0 && (
              <button
                onClick={() => setShowPendingSection(!showPendingSection)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                  showPendingSection
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white text-amber-700 border-amber-200 hover:border-amber-300'
                }`}
              >
                <span className="mr-1">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-3 h-3 inline" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </span>
                {pendingItems.length} from duplicates
              </button>
            )}
            {(['sell', 'donate', 'recycle'] as DisposalMethod[]).map((method) => {
              const count = recCounts[method];
              if (count === 0) return null;
              const labels: Record<DisposalMethod, string> = {
                sell: 'Best to sell',
                donate: 'Best to donate',
                recycle: 'Best to recycle',
              };
              return (
                <button
                  key={method}
                  onClick={() => setActiveCategory(method)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                    activeCategory === method
                      ? 'bg-[#0f172a] text-white border-[#0f172a]'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {labels[method]} {count} best to {method}
                </button>
              );
            })}
          </div>
        )}

        {/* Pending Action Items Inline Section */}
        {showPendingSection && pendingItems.length > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-amber-900">
                  {pendingItems.length} item{pendingItems.length !== 1 ? 's' : ''} from duplicates
                </h3>
                <p className="text-xs text-amber-600 mt-0.5">Choose an action to find nearby partners</p>
              </div>
              <button
                onClick={() => { setShowPendingSection(false); setPendingActionType(null); }}
                className="text-amber-400 hover:text-amber-600 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Items horizontal scroll */}
            <div className="flex gap-3 overflow-x-auto pb-3">
              {pendingItems.map((item) => (
                <div key={item.id} className="shrink-0 w-24">
                  <div className="aspect-[3/4] rounded-xl overflow-hidden bg-white mb-1.5 shadow-sm">
                    {(item as Record<string, unknown>).image_url ? (
                      <img
                        src={(item as Record<string, unknown>).image_url as string}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-amber-300">
                        No Image
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-amber-900 truncate">{item.name}</p>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-3">
              {(['donate', 'sell', 'recycle'] as DisposalMethod[]).map((action) => (
                <button
                  key={action}
                  onClick={() => handlePendingActionSelect(action)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${
                    pendingActionType === action && activeCategory === action
                      ? 'bg-[#0f172a] text-white'
                      : 'bg-white text-amber-800 border border-amber-200 hover:border-amber-300'
                  }`}
                >
                  {action === 'sell' ? 'Sell & Trade' : action.charAt(0).toUpperCase() + action.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

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
        items={showPendingSection ? pendingItems : wardrobeItems}
        loading={showPendingSection ? loadingPending : loadingItems}
        onConfirm={handleConfirmPledge}
        recommendations={showPendingSection ? pendingRecommendations : recommendations}
      />
    </div>
  );
}
