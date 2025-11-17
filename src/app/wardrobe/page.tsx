"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Loader from "../components/Loader";

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

  useEffect(() => {
    // not logged in, force to login first
    if (status === "unauthenticated") {
      router.push("/login");
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

  if (loading) {
    return <Loader message={"Loading your wardrobe… ✨"} />;
  }

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-2xl text-black font-semibold mb-5 ">
        👚 My Wardrobe
      </h1>

      {/* if wardrobe empty */}
      {clothes.length === 0 && (
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {clothes.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-xl overflow-hidden shadow hover:shadow-lg cursor-pointer"
            onClick={() => router.push(`/wardrobe/${item.id}`)}
          >
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                className="h-44 w-full object-cover"
              />
            ) : (
              <div className="h-44 w-full bg-gray-200 flex items-center justify-center text-gray-500">
                No Image
              </div>
            )}

            <div className="p-3">
              <p className="text-black font-medium">{item.name}</p>
              <p className="text-sm text-gray-500">{item.type}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Add Button (bottom right) */}
      <button
        onClick={() => router.push("/wardrobe/upload")}
        className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700"
      >
        ➕
      </button>
    </div>
  );
}
