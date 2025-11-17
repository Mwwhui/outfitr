"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";

type Clothes = {
  id: string;
  name: string;
  category: string;
  color: string;
  image_url?: string;
};

export default function EditWardrobePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [clothes, setClothes] = useState<Clothes | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function fetchData() {
      try {
        const res = await fetch(`/api/clothes/${id}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          console.error("Failed to fetch item:", res.statusText);
          return;
        }

        const data = await res.json();
        setClothes(data);
      } catch (e) {
        console.error("Fetch error:", e);
      } finally {
        setLoading(false);
      }
    }

    async function fetchCategories() {
      try {
        const res = await fetch("/api/categories");

        if (!res.ok) return;

        const list = await res.json();
        setCategories(list ?? []);
      } catch (e) {
        console.error("Category fetch error:", e);
      }
    }

    fetchData();
    fetchCategories();
  }, [id]);

  const updateField = (field: string, value: string) => {
    setClothes((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleUpdate = async () => {
    if (!clothes) return;

    setSaving(true);

    await fetch(`/api/clothes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: clothes.name,
        category: clothes.category,
        color: clothes.color,
      }),
    });

    setSaving(false);
    router.push("/wardrobe");
  };

  const handleDelete = async () => {
    if (!confirm("Confirm delete?")) return;
    setDeleting(true);
    await fetch(`/api/clothes/${id}`, { method: "DELETE" });
    setDeleting(false);

    router.push("/wardrobe");
    router.push("/wardrobe");
  };

  if (loading) return <p className="text-center p-10">Loading...</p>;

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-6">Edit Clothing</h1>

      {clothes?.image_url && (
        <div className="mb-6">
          <Image
            src={clothes.image_url}
            alt={clothes.name}
            width={400}
            height={400}
            className="rounded-lg object-cover w-full h-80"
          />
        </div>
      )}

      <div className="flex flex-col gap-4">
        <input
          type="text"
          value={clothes?.name ?? ""}
          onChange={(e) => updateField("name", e.target.value)}
          className="border px-4 py-3 rounded-lg"
          placeholder="Name"
        />

        {/* ✅ Category dropdown populated from database */}
        <select
          value={clothes?.category ?? ""}
          onChange={(e) => updateField("category", e.target.value)}
          className="border px-4 py-3 rounded-lg"
        >
          <option value="">Select category...</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={clothes?.color ?? ""}
          onChange={(e) => updateField("color", e.target.value)}
          className="border px-4 py-3 rounded-lg"
          placeholder="Color"
        />
      </div>

      <div className="mt-8 flex gap-3">
        <button
          onClick={handleUpdate}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}
