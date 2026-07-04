"use client";

import { useMemo, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { clothesOptions, clustersOptions, useClothes, useCategories, useClusters, type ClothingItem } from "@/hooks/queries/wardrobe";
import Loader from "../components/Loader";
import WardrobeFilters from "../components/WardrobeFilters";
import DuplicateCompareModal from "../components/DuplicateCompareModal";

export default function WardrobePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const { data: categories } = useCategories();
  const { data: clothes, isLoading: clothesLoading } = useClothes(session?.user?.id);
  const { data: clusterData, isLoading: clustersLoading } = useClusters(session?.user?.id);

  const [filters, setFilters] = useState({
    category: "",
    favoritesOnly: false,
    search: "",
  });
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null);
  const [compareGroup, setCompareGroup] = useState<any | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    const clusterParam = searchParams.get('cluster');
    if (clusterParam !== null) {
      setSelectedCluster(Number(clusterParam));
    }
  }, [searchParams]);

  const getCategoryColor = (categoryName: string) => {
    return categories?.find((c) => c.name === categoryName);
  };

  const selectedClusterData = useMemo(() => {
    if (selectedCluster === null || !clusterData) return null;
    return clusterData.clusters.find(c => c.id === selectedCluster) || null;
  }, [selectedCluster, clusterData]);

  const jumpToColors = useMemo(() => {
    if (!selectedClusterData?.groups) return [];
    return [...new Set(selectedClusterData.groups.map(g => g.color || 'Other'))];
  }, [selectedClusterData]);

  const filteredClothes = useMemo(() => {
    let filtered = (clothes || []).filter((item) => {
      if (filters.favoritesOnly && !item.favorite) return false;
      if (filters.category && item.type !== filters.category) return false;
      if (
        filters.search &&
        !item.name.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });

    if (selectedClusterData) {
      const ids = new Set(selectedClusterData.items.map(i => i.id));
      filtered = filtered.filter(item => ids.has(item.id));
    }

    return filtered.sort((a, b) => {
      const aFav = !!a.favorite;
      const bFav = !!b.favorite;
      if (aFav === bFav) return 0;
      return aFav ? -1 : 1;
    });
  }, [clothes, filters, selectedClusterData]);

  if (status === 'loading' || clothesLoading) {
    return <Loader message={"Loading your wardrobe… ✨"} />;
  }

  return (
    <div className="min-h-screen">
      <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-[#163422] font-headline">My Wardrobe</h1>
      </div>

    <div className="px-6 pb-16 max-w-7xl mx-auto space-y-8">
      {/* Filters row */}
      <WardrobeFilters
        categories={categories || []}
        filters={filters}
        onChange={setFilters}
      />

      {/* Cluster pill row */}
      {clusterData?.clusters && clusterData.clusters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedCluster(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              selectedCluster === null
                ? 'bg-[#0f172a] text-white'
                : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            All ({(clothes || []).length})
          </button>
          {clusterData.clusters.map((cluster) => {
            const isActive = selectedCluster === cluster.id;
            return (
              <button
                key={cluster.id}
                onClick={() =>
                  setSelectedCluster(isActive ? null : cluster.id)
                }
                style={{
                  backgroundColor: isActive ? cluster.color : undefined,
                  borderColor: cluster.color,
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  isActive
                    ? 'text-white'
                    : 'bg-white border text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span
                  style={{ backgroundColor: cluster.color }}
                  className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                />
                {cluster.label} ({cluster.size})
              </button>
            );
          })}
        </div>
      )}

      {/* JUMP TO color pills — only for duplicates */}
      {jumpToColors.length > 0 && (
        <div className="flex items-center gap-2 mt-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 select-none">Jump to</span>
          <div className="flex gap-1.5 flex-wrap">
            {jumpToColors.map((color) => (
              <button
                key={color}
                onClick={() => {
                  const el = document.getElementById(`dup-group-${color}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-1.5"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full border border-slate-200 shrink-0"
                  style={{ backgroundColor: color === 'black' ? '#1e293b' : color === 'white' ? '#f8fafc' : color === 'grey' ? '#94a3b8' : color === 'blue' ? '#3b82f6' : color === 'red' ? '#ef4444' : color === 'green' ? '#22c55e' : color === 'brown' ? '#a16207' : color === 'pink' ? '#ec4899' : color === 'purple' ? '#a855f7' : color === 'orange' ? '#f97316' : color === 'yellow' ? '#eab308' : '#cbd5e1' }}
                />
                {color.charAt(0).toUpperCase() + color.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* if wardrobe empty (after filters) */}
      {filteredClothes.length === 0 && (
        <div className="text-center text-black mt-6">
          Your wardrobe is empty 😢
          <br />
          <button
            onClick={() => router.push("/wardrobe/upload")}
            className="mt-3 text-blue-600 underline"
          >
            Add your first item
          </button>
        </div>
      )}

      {selectedClusterData?.groups ? (
        /* Duplicate groups view */
        <div className="space-y-5 mt-4">
          {selectedClusterData.groups.map((group, gi) => (
            <div
              key={gi}
              id={`dup-group-${group.color || 'Other'}`}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden scroll-mt-4"
            >
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: group.color === 'black' ? '#1e293b' : group.color === 'white' ? '#f8fafc' : group.color === 'grey' ? '#94a3b8' : group.color === 'blue' ? '#3b82f6' : group.color === 'red' ? '#ef4444' : group.color === 'green' ? '#22c55e' : group.color === 'brown' ? '#a16207' : group.color === 'pink' ? '#ec4899' : group.color === 'purple' ? '#a855f7' : group.color === 'orange' ? '#f97316' : group.color === 'yellow' ? '#eab308' : '#cbd5e1' }}
                />
                <span className="text-sm font-bold capitalize">{group.color || 'Unknown'}</span>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-500 font-medium">{group.type}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-1 rounded-full">{group.items.length} items</span>
                <button
                  onClick={() => setCompareGroup(group)}
                  className="ml-auto px-3 py-1.5 rounded-full bg-black text-white text-[11px] font-semibold hover:bg-slate-800 transition flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Compare
                </button>
              </div>
              <div className="p-4 flex gap-4 overflow-x-auto">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="shrink-0 w-36 cursor-pointer group/item transition-transform hover:scale-105"
                    onClick={() => router.push(`/wardrobe/${item.id}`)}
                  >
                    <div className="aspect-[3/4] rounded-xl overflow-hidden bg-slate-100 mb-2 shadow-sm relative">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">No Image</div>
                      )}
                      {item.status === 'pending_action' && (
                        <div className="absolute top-1.5 right-1.5 bg-amber-500 text-white rounded-full px-1.5 py-0.5 text-[9px] font-bold shadow-sm">
                          Pending in Pre-Loved
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-medium truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400">Worn {item.wear_count}×</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Flat wardrobe grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mt-4">
          {filteredClothes.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl overflow-hidden shadow hover:shadow-lg cursor-pointer transition-transform transform hover:scale-105 relative"
              onClick={() => router.push(`/wardrobe/${item.id}`)}
              style={{ cursor: "pointer" }}
            >
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="h-50 w-full object-cover"
                />
              ) : (
                <div className="h-50 w-full bg-gray-200 flex items-center justify-center text-gray-500">
                  No Image
                </div>
              )}

              {/* Pending badge */}
              {(item as Record<string, unknown>).status === 'pending_action' && (
                <div className="absolute top-1.5 right-1.5 bg-amber-500 text-white rounded-full px-1.5 py-0.5 text-[9px] font-bold shadow-sm">
                  Pending in Pre-Loved
                </div>
              )}

              <div className="p-3">
                {item.type && getCategoryColor(item.type) && (
                  <div
                    className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mb-1.25 ${
                      getCategoryColor(item.type)?.color
                    } ${getCategoryColor(item.type)?.textColor}`}
                  >
                    {item.type}
                  </div>
                )}

                {/* NAME + CLICKABLE FAVOURITE ICON */}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] text-black px-2 truncate">
                    {item.name}
                  </p>

                  {/* Favourite toggle */}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const updatedFav = !item.favorite;

                      queryClient.setQueryData(['clothes'], (old: ClothingItem[] | undefined) =>
                        old?.map((c) =>
                          c.id === item.id ? { ...c, favorite: updatedFav } : c
                        )
                      );

                      await fetch(`/api/clothes/${item.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ favorite: updatedFav }),
                      });
                    }}
                    className="p-1"
                    aria-label="Toggle favourite"
                  >
                    {item.favorite ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="w-5 h-5 text-pink-500"
                        fill="currentColor"
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l8.84 8.84 8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="w-5 h-5 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.7}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l8.84 8.84 8.84-8.84a5.5 5.5 0 0 0 0-7.78z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Add Button*/}
      <button
        onClick={() => router.push("/wardrobe/upload")}
        className="fixed bottom-6 right-6 bg-black text-white rounded-full w-16 h-16 shadow-lg hover:bg-gray-800 flex items-center justify-center text-3xl"
        aria-label="Add item"
      >
        <span className="leading-none">+</span>
      </button>

      {/* Compare Modal */}
      <DuplicateCompareModal
        open={!!compareGroup}
        group={compareGroup}
        onClose={() => {
          setCompareGroup(null);
                      queryClient.invalidateQueries(clothesOptions(session?.user?.id));
                      queryClient.invalidateQueries(clustersOptions(session?.user?.id));
        }}
      />
    </div>
    </div>
  );
}
