"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Loader from "../components/Loader";
import WardrobeFilters from "../components/WardrobeFilters";

interface Category {
  id: string;
  name: string;
  color: string;
  textColor: string;
}

type ClothingItem = {
  id: string;
  name: string;
  type: string;
  image_url?: string;
  favorite?: boolean;
};

interface ClusterGroup {
  id: number;
  label: string;
  color: string;
  size: number;
  items: { id: string; name: string; type: string; image_url: string | null; wear_count: number; price: number }[];
}

export default function WardrobePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [clothes, setClothes] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState({
    category: "",
    favoritesOnly: false,
    search: "",
  });
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null);
  const [clusterData, setClusterData] = useState<{ clusters: ClusterGroup[] } | null>(null);

  useEffect(() => {
    // Fetch categories on mount
    const fetchCategories = async () => {
      try {
        const res = await fetch("/api/categories");
        if (!res.ok) throw new Error("Failed to fetch categories");
        const data = await res.json();
        setCategories(data);
      } catch (error) {
        console.error("Error fetching categories:", error);
        setCategories([]);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    // not logged in, force to login first
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }

    if (status === "authenticated") {
      fetchClothes();
      fetch('/api/wardrobe/clusters')
        .then(async r => {
          const json = await r.json();
          console.log('Clusters API:', r.status, json);
          if (json && Array.isArray(json.clusters)) setClusterData(json);
        })
        .catch(err => console.error('Clusters fetch failed:', err));
    }
  }, [status]);

  useEffect(() => {
    const clusterParam = searchParams.get('cluster');
    if (clusterParam !== null) {
      setSelectedCluster(Number(clusterParam));
    }
  }, [searchParams]);

  const fetchClothes = async () => {
    const res = await fetch(`/api/clothes?user_id=${session?.user?.id}`);
    const data = await res.json();

    setClothes(data);
    setLoading(false);
  };

  const getCategoryColor = (categoryName: string) => {
    return categories.find((c) => c.name === categoryName);
  };

  const filteredClothes = useMemo(() => {
    let filtered = clothes.filter((item) => {
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

    if (selectedCluster !== null && clusterData) {
      const cluster = clusterData.clusters.find(c => c.id === selectedCluster);
      if (cluster) {
        const ids = new Set(cluster.items.map(i => i.id));
        filtered = filtered.filter(item => ids.has(item.id));
      }
    }

    // favourites first, then others
    return filtered.sort((a, b) => {
      const aFav = !!a.favorite;
      const bFav = !!b.favorite;
      if (aFav === bFav) return 0;
      return aFav ? -1 : 1;
    });
  }, [clothes, filters, selectedCluster, clusterData]);

  if (loading) {
    return <Loader message={"Loading your wardrobe… ✨"} />;
  }
  console.log('Wardrobe render:', { clothes: clothes.length, clusterData, selectedCluster, loading });

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-[#163422]">My Wardrobe</h1>

          <div className="flex gap-6 border-b border-slate-200">
          {/* Wardrobe Tab */}
          <button
            onClick={() => router.push("/wardrobe")}
            className={`text-sm flex items-center gap-2 -mb-[1px] ${
              pathname === "/wardrobe"
                ? "border-b-2 border-black font-semibold text-black"
                : "text-slate-500 hover:text-black"
            }`}
          >
            {/* Closet Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <rect x="4" y="3" width="16" height="18" rx="1.5" />
              <line x1="12" y1="3" x2="12" y2="21" />
              <circle cx="9" cy="12" r="0.6" />
              <circle cx="15" cy="12" r="0.6" />
            </svg>
            Wardrobe
          </button>

          {/* Planner Tab */}
          <button
            onClick={() => router.push("/planner")}
            className={`text-sm flex items-center gap-2 -mb-[1px] ${
              pathname === "/planner"
                ? "border-b-2 border-black font-semibold text-black"
                : "text-slate-500 hover:text-black"
            }`}
          >
            {/* Pencil Note Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <rect x="4" y="4" width="11" height="16" rx="1.4" />
              <line x1="7" y1="8" x2="13" y2="8" />
              <line x1="7" y1="11" x2="12" y2="11" />
              <path d="M15.5 9.5l3.2-3.2a1.4 1.4 0 0 1 2 2l-3.2 3.2-2.4.4.4-2.4z" />
            </svg>
            Plan Outfit
          </button>

          {/* Style Lab Tab */}
          <button
            onClick={() => router.push("/outfits")}
            className={`text-sm flex items-center gap-2 -mb-[1px] ${
              pathname === "/outfits"
                ? "border-b-2 border-black font-semibold text-black"
                : "text-slate-500 hover:text-black"
            }`}
          >
            {/* Sparkle Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z" />
              <path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" opacity="0.6" />
            </svg>
            Style Lab
          </button>

          {/* Calendar Tab */}
          <button
            onClick={() => router.push("/calendar")}
            className={`text-sm flex items-center gap-2 -mb-[1px] ${
              pathname === "/calendar"
                ? "border-b-2 border-black font-semibold text-black"
                : "text-slate-500 hover:text-black"
            }`}
          >
            {/* Calendar Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <rect x="3.5" y="5" width="17" height="15" rx="2" />
              <line x1="3.5" y1="9" x2="20.5" y2="9" />
              <line x1="9" y1="3" x2="9" y2="7" />
              <line x1="15" y1="3" x2="15" y2="7" />
              <circle cx="9" cy="13" r="0.7" />
              <circle cx="15" cy="13" r="0.7" />
              <circle cx="9" cy="17" r="0.7" />
              <circle cx="15" cy="17" r="0.7" />
            </svg>
            Calendar
          </button>
        </div>
      </div>
    </div>

    <div className="px-6 pb-16 max-w-7xl mx-auto space-y-8">
      {/* Filters row */}
      <WardrobeFilters
        categories={categories}
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
            All ({clothes.length})
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

      {/* wardrobe grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mt-4">
        {filteredClothes.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-xl overflow-hidden shadow hover:shadow-lg cursor-pointer transition-transform transform hover:scale-105"
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
                    e.stopPropagation(); // prevent opening item page

                    const updatedFav = !item.favorite;

                    // update UI instantly
                    setClothes((prev) =>
                      prev.map((c) =>
                        c.id === item.id ? { ...c, favorite: updatedFav } : c
                      )
                    );

                    // send update to backend
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
                    // Filled heart
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      className="w-5 h-5 text-pink-500"
                      fill="currentColor"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l8.84 8.84 8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  ) : (
                    // Outline heart
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

      {/* Floating Add Button*/}
      <button
        onClick={() => router.push("/wardrobe/upload")}
        className="fixed bottom-6 right-6 bg-black text-white rounded-full w-16 h-16 shadow-lg hover:bg-gray-800 flex items-center justify-center text-3xl"
        aria-label="Add item"
      >
        <span className="leading-none">+</span>
      </button>
    </div>
    </div>
  );
}
