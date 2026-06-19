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
  "Nylon",
];

function rgbToHsv(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (mx === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: (mx === 0 ? 0 : d / mx) * 100, v: mx * 100 };
}

function hsvColorName(h: number, s: number, v: number): string {
  if (s < 10) {
    if (v < 18) return "Black";
    if (v > 88) return "White";
    return "Grey";
  }
  if (v < 12) return "Black";
  if (h > 20 && h < 70 && s < 30 && v > 75) return v > 92 ? "Cream" : "Beige";
  if (h < 60 && v < 65) return "Brown";
  if (h < 60 && v < 80 && s > 25 && s < 70) return "Brown";
  if (h > 200 && h < 290 && v < 30) return "Navy";
  if (h > 210 && h < 260 && v > 30 && v < 65 && s > 30 && s < 65) return "Denim";
  if (h > 200 && h < 290 && s < 25) return "Grey";
  if ((h < 15 || h >= 340) && v > 65 && s < 50) return "Pink";
  if (h > 300 && h < 345) return v > 35 ? "Pink" : "Purple";
  if (h < 15 || h >= 345) return "Red";
  if (h < 45) return "Orange";
  if (h < 70) return "Yellow";
  if (h < 170) return "Green";
  if (h < 260) return "Blue";
  if (h < 300) return "Purple";
  return "Pink";
}

function detectSeason(yoloType?: string, type?: string): string {
  const t = (yoloType || "").toLowerCase();
  if (/outwear|coat$|parka|puffer|sweater|hoodie|jumper|pullover|cardigan/.test(t)) return "Winter";
  if (/short sleeve|tank|shorts|swim|bikini|sundress/.test(t)) return "Summer";
  if (/jacket|blazer|trench/.test(t)) return "Autumn";
  if (/long sleeve|vest/.test(t)) return "Spring";
  if (/jeans|pants|trousers|skirt|denim/.test(t)) return "All";
  if (type === "Bottoms" || type === "Tops") return "All";
  if (type === "Outerwear") return "Winter";
  if (type === "One-Piece") return "Summer";
  return "";
}

const MAX_IMAGE_DIM = 1200;
const JPEG_QUALITY = 0.8;

function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width <= MAX_IMAGE_DIM && height <= MAX_IMAGE_DIM) {
        resolve(file);
        return;
      }
      if (width > height) {
        height = Math.round(height * (MAX_IMAGE_DIM / width));
        width = MAX_IMAGE_DIM;
      } else {
        width = Math.round(width * (MAX_IMAGE_DIM / height));
        height = MAX_IMAGE_DIM;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(new File([blob], file.name, { type: "image/jpeg" }));
          else reject(new Error("Compression failed"));
        },
        "image/jpeg",
        JPEG_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

async function dominantColorFromFile(
  file: File,
  box?: [number, number, number, number],
): Promise<string | null> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  return new Promise((resolve) => {
    img.onload = () => {
      URL.revokeObjectURL(url);
      const size = 32;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      if (box) {
        const [x1, y1, x2, y2] = box;
        ctx.drawImage(img, x1, y1, x2 - x1, y2 - y1, 0, 0, size, size);
      } else {
        const crop = 0.6;
        const sx = (img.width * (1 - crop)) / 2;
        const sy = (img.height * (1 - crop)) / 2;
        ctx.drawImage(img, sx, sy, img.width * crop, img.height * crop, 0, 0, size, size);
      }
      const data = ctx.getImageData(0, 0, size, size).data;
      const votes: Record<string, number> = {};
      for (let i = 0; i < data.length; i += 4) {
        const { h, s, v } = rgbToHsv(data[i], data[i + 1], data[i + 2]);
        const name = hsvColorName(h, s, v);
        votes[name] = (votes[name] || 0) + 1;
      }
      let best = "";
      let max = 0;
      for (const [name, count] of Object.entries(votes)) {
        if (count > max) { max = count; best = name; }
      }
      resolve(best || null);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

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
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [customBrand, setCustomBrand] = useState(false);
  const [price, setPrice] = useState("");
  const [material, setMaterial] = useState<string | "">("");
  const [materialSuggestions, setMaterialSuggestions] = useState<string[]>([]);
  const [customMaterial, setCustomMaterial] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [location, setLocation] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [customLocation, setCustomLocation] = useState(false);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectResult, setDetectResult] = useState<{
    type: string;
    confidence: number;
    color: string | null;
  } | null>(null);

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

  // Fetch brand suggestions from wardrobe
  useEffect(() => {
    if (!session?.user?.id) return;
    Promise.all([
      fetch(`/api/brands?user_id=${session.user.id}`).then((r) => r.json()),
      fetch(`/api/locations?user_id=${session.user.id}`).then((r) => r.json()),
      fetch(`/api/materials?user_id=${session.user.id}`).then((r) => r.json()),
    ])
      .then(([brandsData, locationsData, materialsData]) => {
        setBrandSuggestions(brandsData.brands || []);
        setLocationSuggestions(locationsData.locations || []);
        setMaterialSuggestions(materialsData.materials || []);
      })
      .catch(() => {});
  }, [session]);

  // Auto-detect clothing type (YOLO) and color (client-side on YOLO crop)
  useEffect(() => {
    if (!imageFile) return;
    let dismissTimer: ReturnType<typeof setTimeout>;
    const detect = async () => {
      setDetecting(true);
      setDetectResult(null);
      try {
        const fd = new FormData();
        fd.append("file", imageFile);
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_YOLO_API_URL}/detect`,
          { method: "POST", body: fd },
        );
        const data = await res.json();
        const item = data.items?.[0];
        const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
        const title = (s: string) => s.split(" ").map(cap).join(" ");
        if (item?.type) setType(item.type);
        const box = item?.box as [number, number, number, number] | undefined;
        const dominantColor = await dominantColorFromFile(imageFile, box);
        if (dominantColor) setColor(dominantColor);
        const desc = item?.yolo_type || item?.type;
        const label = [dominantColor, desc].filter(Boolean).map(title).join(" ");
        if (label) setName(label);
        const seasonGuess = detectSeason(item?.yolo_type, item?.type);
        if (seasonGuess) setSeason(seasonGuess);
        if (desc) {
          setDetectResult({
            type: title(desc),
            confidence: item.confidence,
            color: dominantColor,
          });
          dismissTimer = setTimeout(() => setDetectResult(null), 4000);
        }
      } catch (e) {
        console.error("Auto-detect failed:", e);
      } finally {
        setDetecting(false);
      }
    };
    detect();
    return () => clearTimeout(dismissTimer);
  }, [imageFile]);

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
      // 0. Compress image before upload
      const compressed = await compressImage(imageFile);
      // 1. Upload image
      const formData = new FormData();
      formData.append("file", compressed);

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
                <div className="relative w-full h-full">
                  <img
                    src={imagePreview}
                    alt={name || "Clothing preview"}
                    className="w-full h-full object-cover"
                  />
                  {detecting && (
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-white/90 text-xs text-slate-600 px-2.5 py-1.5 rounded-full z-10 shadow-sm backdrop-blur-sm">
                      <span className="relative flex w-1.5 h-1.5">
                        <span className="absolute inline-flex w-full h-full rounded-full bg-slate-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-slate-500" />
                      </span>
                      <span className="tracking-wider font-medium">Detecting</span>
                    </div>
                  )}
                  {detectResult && (
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-white/90 text-xs text-slate-600 px-2.5 py-1.5 rounded-full z-10 shadow-sm backdrop-blur-sm animate-in fade-in slide-in-from-top-1 duration-300">
                      <span className="text-amber-500 text-[10px]">✦</span>
                      <span className="font-medium">{detectResult.type}</span>
                      <span className={`font-mono tabular-nums ${
                        detectResult.confidence >= 0.8 ? 'text-emerald-600' :
                        detectResult.confidence >= 0.6 ? 'text-amber-600' :
                        'text-red-500'
                      }`}>
                        {Math.round(detectResult.confidence * 100)}%
                      </span>
                      {detectResult.color && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span>{detectResult.color}</span>
                        </>
                      )}
                    </div>
                  )}
                  {detectResult && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 pt-1 px-1 animate-in fade-in duration-300">
                      <span className="text-amber-400">✦</span>
                      <span>AI detected at {Math.round(detectResult.confidence * 100)}% confidence</span>
                    </div>
                  )}
                </div>
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
                  <p className="text-[10px] text-slate-300 mt-1">✦ AI will detect type & color</p>
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
              {customBrand ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className={inputBase}
                    placeholder="Type brand name..."
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => { setBrand(""); setCustomBrand(false); }}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    ← Pick from saved brands
                  </button>
                </div>
              ) : (
                <select
                  value={brand}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setCustomBrand(true);
                      setBrand("");
                    } else {
                      setBrand(e.target.value);
                    }
                  }}
                  className={inputBase}
                >
                  <option value="">Select brand...</option>
                  {brandSuggestions.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  <option value="__custom__">+ Add new brand</option>
                </select>
              )}
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
              {customMaterial ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    className={inputBase}
                    placeholder="Type material name..."
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => { setMaterial(""); setCustomMaterial(false); }}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    ← Pick from saved materials
                  </button>
                </div>
              ) : (
                <select
                  value={material}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setCustomMaterial(true);
                      setMaterial("");
                    } else {
                      setMaterial(e.target.value);
                    }
                  }}
                  className={inputBase}
                >
                  <option value="">Select material...</option>
                  {MATERIALS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  {materialSuggestions
                    .filter((m) => !MATERIALS.includes(m))
                    .map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  <option value="__custom__">+ Add new material</option>
                </select>
              )}
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
              {customLocation ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className={inputBase}
                    placeholder="e.g. Wardrobe A, Drawer 2"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => { setLocation(""); setCustomLocation(false); }}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    ← Pick from saved locations
                  </button>
                </div>
              ) : (
                <select
                  value={location}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setCustomLocation(true);
                      setLocation("");
                    } else {
                      setLocation(e.target.value);
                    }
                  }}
                  className={inputBase}
                >
                  <option value="">Select location...</option>
                  {locationSuggestions.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                  <option value="__custom__">+ Add new location</option>
                </select>
              )}
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
              className="px-6 py-3 rounded-lg bg-black text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {isUploading ? "Uploading..." : "Save clothing"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
