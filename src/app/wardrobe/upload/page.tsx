"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Category {
  id: string;
  name: string;
  color: string;
  textColor: string;
}

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

const inputBase =
  "w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 " +
  "focus:ring-2 focus:ring-slate-500/70 px-3 py-2";

export default function UploadClothesPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [color, setColor] = useState("");
  const [season, setSeason] = useState<string | "">("");
  const [size, setSize] = useState<string | "">("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [material, setMaterial] = useState<string | "">("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch("/api/categories");
        if (!res.ok) throw new Error("Failed to fetch categories");
        const data = await res.json();
        setCategories(data);
      } catch (error) {
        console.error("Error fetching categories:", error);
        setCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  // Clean up blob URLs when file changes
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleImageChange = (file: File | null) => {
    setImageFile(file);

    if (imagePreview) URL.revokeObjectURL(imagePreview);

    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    } else {
      setImagePreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.user?.id) {
      setErrorMsg("You must be logged in.");
      return;
    }
    if (!imageFile) {
      setErrorMsg("Please select an image.");
      return;
    }
    if (!name.trim()) {
      setErrorMsg("Please enter a name.");
      return;
    }

    setIsUploading(true);
    setErrorMsg("");

    try {
      // 1. Upload image
      const formData = new FormData();
      formData.append("file", imageFile);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || "Upload failed");
      }

      const imageUrl = uploadData.url;

      // 2. Save clothing data
      const saveRes = await fetch("/api/clothes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: session.user.id,
          name,
          type,
          color,
          season: season || null,
          size: size || null,
          brand: brand || null,
          price: price === "" ? null : Number(price),
          material: material || null,
          favorite: false,
          image_url: imageUrl,
          categories: null,
          description: description || null,
          purchase_date: purchaseDate || null,
          location: location || null,
          notes: notes || null,
        }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error || "Failed to save clothing");
      }

      router.push("/wardrobe");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Something went wrong");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        ← Back
      </button>

      <h1 className="text-3xl font-bold mb-6">Add New Clothing</h1>

      {errorMsg && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
          {errorMsg}
        </p>
      )}

      {/* Layout: left = image + main info, right = details */}
      <form
        onSubmit={handleSubmit}
        className="grid gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)]"
      >
        {/* LEFT */}
        <div className="space-y-4 h-full">
          {/* hidden file input */}
          <input
            id="imageUpload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
          />

          <div className="relative rounded-3xl overflow-hidden shadow-sm bg-white">
            {/* Clickable image upload / preview area */}
            <label
              htmlFor="imageUpload"
              className="w-full h-100 bg-slate-100 rounded-b-none overflow-hidden cursor-pointer 
                         border-b border-slate-200 hover:bg-slate-200 transition flex items-center justify-center"
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt={name || "Clothing preview"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center text-slate-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-10 h-10 mx-auto mb-2 opacity-60"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <p className="text-sm font-medium">Click to upload image</p>
                  <p className="text-xs">JPG, PNG, up to 10MB</p>
                </div>
              )}
            </label>

            <div className="p-4 space-y-3">
              {/* Name */}
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputBase}
                  placeholder="e.g. White T-Shirt"
                  required
                />
              </div>

              {/* Type + Color */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-visible">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">
                    Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className={`${inputBase} relative z-10 appearance-auto`}
                    required
                  >
                    <option value="">Select type...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-600 mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className={inputBase}
                    placeholder="e.g. Black"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT – Details */}
        <div className="bg-white rounded-3xl p-6 shadow-md space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Details</h2>
            <p className="text-sm text-gray-500">
              Add more information so you can filter and find this piece later.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Season */}
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Season
              </label>
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className={inputBase}
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
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className={inputBase}
              >
                <option value="">Select size...</option>
                {SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Brand */}
            <div>
              <label className="block text-xs text-slate-600 mb-1">Brand</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className={inputBase}
                placeholder="e.g. Uniqlo"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-xs text-slate-600 mb-1">Price</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={inputBase}
                placeholder="0.00"
              />
            </div>

            {/* Material */}
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Material
              </label>
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className={inputBase}
              >
                <option value="">Select material...</option>
                {MATERIALS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Purchase date */}
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Purchase date
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className={inputBase}
              />
            </div>

            {/* Location */}
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-600 mb-1">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={inputBase}
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputBase} min-h-[80px]`}
              placeholder="Extra details about this piece..."
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-slate-600 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${inputBase} min-h-[80px]`}
              placeholder="Care instructions, outfit ideas, where you wore it..."
            />
          </div>

          {/* ACTIONS */}
          <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              onClick={() => router.push("/wardrobe")}
              className="px-6 py-3 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isUploading}
              className="px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isUploading ? "Uploading..." : "Save clothing"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
