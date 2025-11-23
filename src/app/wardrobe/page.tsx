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
    return clothes.filter((item) => {
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
            style={{ cursor: "pointer" }} // Ensures cursor turns to pointer
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
                  className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mb-2 ${
                    getCategoryColor(item.type)?.color
                  } ${getCategoryColor(item.type)?.textColor}`}
                >
                  {item.type}
                </div>
              )}
              <p className="text-black font-medium block px-2">{item.name}</p>
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
