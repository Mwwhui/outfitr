"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";

interface Category {
  id: string;
  name: string;
  color: string;
  textColor: string;
}

type Clothes = {
  id: string;
  user_id: string;
  name: string;
  type: string; // category of item
  color: string;
  season: string | null;
  size: string | null;
  brand: string | null;
  price: number | null;
  material: string | null;
  favorite: boolean | null;
  image_url: string | null;
  categories: string[] | null;
  description: string | null;
  purchase_date: string | null; // date as "YYYY-MM-DD"
  location: string | null;
  notes: string | null;

  created_at?: string;
  updated_at?: string | null;
  deleted_at?: string | null;
};

const SEASONS = ["All", "Spring", "Summer", "Autumn", "Winter"];
const SIZES = ["XS", "S", "M", "L", "XL"];
const MATERIALS = [
  "Cotton",
  "Linen",
  "Silk",
  "Wool",
  "Denim",
  "Leather",
  "Synthetic",
];

export default function EditWardrobePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [clothes, setClothes] = useState<Clothes | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditingMainInfo, setIsEditingMainInfo] = useState(false);

  // Fetch item and category list
  useEffect(() => {
    if (!id) return;

    async function fetchItem() {
      try {
        const res = await fetch(`/api/clothes/${id}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          console.error("Failed to fetch item:", res.statusText);
          setLoading(false);
          return;
        }

        const raw = await res.json();

        // normalise price from numeric (string) to number
        const normalised: Clothes = {
          ...raw,
          price:
            raw.price === null || raw.price === undefined
              ? null
              : Number(raw.price),
        };

        setClothes(normalised);
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

    fetchItem();
    fetchCategories();
  }, [id]);

  const updateField = <K extends keyof Clothes>(
    field: K,
    value: Clothes[K]
  ) => {
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
        type: clothes.type,
        color: clothes.color,
        season: clothes.season,
        size: clothes.size,
        brand: clothes.brand,
        price: clothes.price,
        material: clothes.material,
        favorite: clothes.favorite ?? false,
        image_url: clothes.image_url,
        categories: clothes.categories,
        description: clothes.description,
        purchase_date: clothes.purchase_date,
        location: clothes.location,
        notes: clothes.notes,
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
  };

  if (loading || !clothes) {
    return <p className="text-center p-10">Loading...</p>;
  }

  const purchaseDateValue = clothes.purchase_date
    ? clothes.purchase_date.slice(0, 10)
    : "";

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        ← Back
      </button>

      <h1 className="text-3xl font-bold mb-6">Edit Clothing</h1>

      {clothes.type && (
        <div className="mb-3">
          <span
            className={`inline-block px-4 py-1.5 rounded-full text-sm font-semibold ${
              categories.find((c) => c.name === clothes.type)?.color ?? ""
            } ${
              categories.find((c) => c.name === clothes.type)?.textColor ?? ""
            }`}
          >
            {clothes.type}
          </span>
        </div>
      )}

      {/* Layout: left = image + main info, right = details */}
      <div className="grid gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)]">
        {/* LEFT */}
        <div className="space-y-4 h-full">
          <div className="relative rounded-3xl overflow-hidden shadow-sm bg-white">
            {clothes.image_url && (
              <Image
                src={clothes.image_url}
                alt={clothes.name}
                width={600}
                height={600}
                className="object-cover w-full h-80"
              />
            )}

            {/* Heart icon button */}
            <button
              type="button"
              onClick={() =>
                updateField("favorite", !(clothes.favorite ?? false))
              }
              aria-pressed={!!clothes.favorite}
              title={
                clothes.favorite ? "Unmark favourite" : "Mark as favourite"
              }
              className={`absolute top-3 right-3 z-20 inline-flex items-center justify-center p-2 rounded-full shadow transition ${
                clothes.favorite
                  ? "bg-pink-500 text-white hover:brightness-95"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {clothes.favorite ? (
                // filled heart
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="w-5 h-5"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l8.84 8.84 8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              ) : (
                // outlined heart
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l8.84 8.84 8.84-8.84a5.5 5.5 0 0 0 0-7.78z"
                  />
                </svg>
              )}
            </button>

            {/* Main info */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                {/* Name + color + category */}
                <div className="space-y-2">
                  {isEditingMainInfo ? (
                    <>
                      {/* Editable name */}
                      <input
                        type="text"
                        value={clothes.name}
                        onChange={(e) => updateField("name", e.target.value)}
                        className="w-full rounded-xl border border-slate-200 text-sm font-semibold placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2"
                        placeholder="Clothing name"
                      />

                      {/* Editable color */}
                      <input
                        type="text"
                        value={clothes.color}
                        onChange={(e) => updateField("color", e.target.value)}
                        className="w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2"
                        placeholder="Color"
                      />
                    </>
                  ) : (
                    <>
                      <h2 className="text-lg font-semibold truncate">
                        {clothes.name}
                      </h2>
                      <p className="text-sm text-gray-500">{clothes.color}</p>
                    </>
                  )}
                </div>

                {/* Pencil / done icon */}
                <button
                  type="button"
                  onClick={() => setIsEditingMainInfo((prev) => !prev)}
                  className="inline-flex items-center text-gray-500 hover:text-gray-700 transition"
                  aria-label={
                    isEditingMainInfo
                      ? "Done editing name and color"
                      : "Edit name and color"
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="w-4 h-4 relative top-[1px]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.862 3.487l3.651 3.651a1.5 1.5 0 0 1 0 2.121l-9.193 9.193a2 2 0 0 1-1.061.555l-3.94.657a.75.75 0 0 1-.866-.866l.657-3.94a2 2 0 0 1 .555-1.061l9.193-9.193a1.5 1.5 0 0 1 2.121 0z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="bg-white rounded-3xl p-6 shadow-md space-y-6">
          <h2 className="text-lg font-semibold">Details</h2>
          <p className="text-sm text-gray-500">
            Edit the details of your clothing item below.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Season + Size */}
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Season
              </label>
              <select
                value={clothes.season ?? ""}
                onChange={(e) => updateField("season", e.target.value)}
                className="w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2"
              >
                <option value="">Select season...</option>
                {SEASONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Size */}
            <div>
              <label className="block text-xs text-slate-600 mb-1">Size</label>
              <select
                value={clothes.size ?? ""}
                onChange={(e) => updateField("size", e.target.value)}
                className="w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2"
              >
                <option value="">Select size...</option>
                {SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Brand + Price */}
            <div>
              <label className="block text-xs text-slate-600 mb-1">Brand</label>
              <input
                type="text"
                value={clothes.brand ?? ""}
                onChange={(e) => updateField("brand", e.target.value)}
                className="w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2"
                placeholder="e.g. Uniqlo"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Price</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={clothes.price ?? ""}
                onChange={(e) =>
                  updateField(
                    "price",
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                className="w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2"
                placeholder="0.00"
              />
            </div>

            {/* Material + Purchase Date */}
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Material
              </label>
              <select
                value={clothes.material ?? ""}
                onChange={(e) => updateField("material", e.target.value)}
                className="w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2"
              >
                <option value="">Select material...</option>
                {MATERIALS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Purchase date
              </label>
              <input
                type="date"
                value={purchaseDateValue}
                onChange={(e) => updateField("purchase_date", e.target.value)}
                className="w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Location
              </label>
              <input
                type="text"
                value={clothes.location ?? ""}
                onChange={(e) => updateField("location", e.target.value)}
                className="w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2"
                placeholder="e.g. Wardrobe A, Drawer 2"
              />
            </div>
          </div>

          {/* Divider */}
          <hr className="border-slate-200" />

          {/* Description */}
          <div>
            <label className="block text-xs text-slate-600 mb-1">
              Description
            </label>
            <textarea
              value={clothes.description ?? ""}
              onChange={(e) => updateField("description", e.target.value)}
              className="w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2 min-h-[80px]"
              placeholder="Extra details about this piece..."
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-slate-600 mb-1">Notes</label>
            <textarea
              value={clothes.notes ?? ""}
              onChange={(e) => updateField("notes", e.target.value)}
              className="w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2 min-h-[80px]"
              placeholder="Care instructions, outfit ideas, where you wore it..."
            />
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-end">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:opacity-60"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>

        <button
          onClick={handleUpdate}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}
