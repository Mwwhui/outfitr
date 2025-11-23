"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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

export default function WardrobePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [clothes, setClothes] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState({
    category: "",
    favoritesOnly: false,
    search: "",
  });

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
    }
  }, [status]);

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
    // 1) Filter
    const filtered = clothes.filter((item) => {
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

    // 2) Sort: favourites first, then others
    return filtered.sort((a, b) => {
      const aFav = !!a.favorite;
      const bFav = !!b.favorite;

      if (aFav === bFav) return 0; // keep relative order
      return aFav ? -1 : 1; // favourites first
    });
  }, [clothes, filters]);

  if (loading) {
    return <Loader message={"Loading your wardrobe… ✨"} />;
  }

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-xl text-black font-semibold mb-5 ">My Wardrobe</h1>

      <WardrobeFilters
        categories={categories}
        filters={filters}
        onChange={setFilters}
      />

      {/* if wardrobe empty */}
      {filteredClothes.length === 0 && (
        <div className="text-center text-black">
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
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
                  className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mb-1.75 ${
                    getCategoryColor(item.type)?.color
                  } ${getCategoryColor(item.type)?.textColor}`}
                >
                  {item.type}
                </div>
              )}

              {/* NAME + CLICKABLE FAVOURITE ICON */}
              <div className="flex items-center justify-between gap-2">
                <p className="text-black font-medium px-2 truncate">
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
  );
}
