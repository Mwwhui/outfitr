'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import Image from 'next/image';
import ConfirmModal from '../../components/ConfirmModal';

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

const SEASONS = ['All', 'Spring', 'Summer', 'Autumn', 'Winter'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const MATERIALS = [
  'Cotton',
  'Linen',
  'Silk',
  'Wool',
  'Denim',
  'Leather',
  'Synthetic',
  'Nylon',
];

export default function EditWardrobePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const id = params?.id;

  const [clothes, setClothes] = useState<Clothes | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditingMainInfo, setIsEditingMainInfo] = useState(false);
  const [customBrand, setCustomBrand] = useState(false);
  const [customMaterial, setCustomMaterial] = useState(false);
  const [customLocation, setCustomLocation] = useState(false);
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [materialSuggestions, setMaterialSuggestions] = useState<string[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [similarItems, setSimilarItems] = useState<Array<{id: string; name: string; color: string | null; image_url: string | null; similarity: number}>>([]);
  const [visualResult, setVisualResult] = useState<{is_different: boolean; reasoning: string; confidence: number} | null>(null);
  const [checkingVisual, setCheckingVisual] = useState(false);

  // Fetch item and category list
  useEffect(() => {
    if (!id) return;

    async function fetchItem() {
      try {
        const res = await fetch(`/api/clothes/${id}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          console.error('Failed to fetch item:', res.statusText);
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
        console.error('Fetch error:', e);
      } finally {
        setLoading(false);
      }
    }

    async function fetchCategories() {
      try {
        const res = await fetch('/api/categories');
        if (!res.ok) return;

        const list = await res.json();
        setCategories(list ?? []);
      } catch (e) {
        console.error('Category fetch error:', e);
      }
    }

    fetchItem();
    fetchCategories();
  }, [id]);

  // Fetch suggestions
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    Promise.all([
      fetch(`/api/brands?user_id=${userId}`).then((r) => r.json()),
      fetch(`/api/locations?user_id=${userId}`).then((r) => r.json()),
      fetch(`/api/materials?user_id=${userId}`).then((r) => r.json()),
    ])
      .then(([brandsData, locationsData, materialsData]) => {
        setBrandSuggestions(brandsData.brands || []);
        setLocationSuggestions(locationsData.locations || []);
        setMaterialSuggestions(materialsData.materials || []);
      })
      .catch(() => {});
  }, [session?.user?.id]);

  // Fetch similar items
  useEffect(() => {
    if (!clothes || !session?.user?.id) return;
    const params = new URLSearchParams({
      user_id: session.user.id,
      type: clothes.type,
      exclude_id: clothes.id,
    });
    if (clothes.color) params.set('color', clothes.color);
    fetch(`/api/clothes/similar?${params}`)
      .then((r) => r.json())
      .then((data) => setSimilarItems(data.similar || []))
      .catch(() => {});
  }, [clothes?.id, clothes?.type, clothes?.color, session?.user?.id]);

  // Fire Gemini visual comparison when 1-3 similar items exist
  useEffect(() => {
    if (!clothes?.image_url || similarItems.length < 1 || similarItems.length > 3) return;
    let active = true;
    const check = async () => {
      setCheckingVisual(true);
      try {
        const res = await fetch('/api/clothes/visual-similarity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            new_image: await (async () => {
              const imgRes = await fetch(clothes!.image_url!);
              const buf = Buffer.from(await imgRes.arrayBuffer());
              return buf.toString('base64');
            })(),
            existing_images: similarItems.map((s) => ({
              id: s.id,
              image_url: s.image_url,
              name: s.name,
            })),
            type: clothes!.type,
          }),
        });
        if (res.ok && active) setVisualResult(await res.json());
      } catch {
        // Optional, ignore errors
      } finally {
        if (active) setCheckingVisual(false);
      }
    };
    check();
    return () => { active = false; };
  }, [clothes?.image_url, clothes?.type, similarItems]);

  const updateField = <K extends keyof Clothes>(
    field: K,
    value: Clothes[K],
  ) => {
    setClothes((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleUpdate = async () => {
    if (!clothes) return;
    setSaving(true);

    await fetch(`/api/clothes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
    router.push('/wardrobe');
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/clothes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Item deleted');
      router.push('/wardrobe');
    } catch {
      toast.error('Failed to delete item');
      setDeleting(false);
    } finally {
      setConfirmDelete(false);
    }
  };

  if (loading || !clothes) {
    return <p className="text-center p-10">Loading...</p>;
  }

  const purchaseDateValue = clothes.purchase_date
    ? clothes.purchase_date.slice(0, 10)
    : '';

  return (
    <>
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
              className={`inline-block px-4 py-1.5 rounded-full text-sm font-semibold ${categories.find((c) => c.name === clothes.type)?.color ?? ''} ${categories.find((c) => c.name === clothes.type)?.textColor ?? ''}`}
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
                  updateField('favorite', !(clothes.favorite ?? false))
                }
                aria-pressed={!!clothes.favorite}
                title={
                  clothes.favorite ? 'Unmark favourite' : 'Mark as favourite'
                }
                className={`absolute top-3 right-3 z-20 inline-flex items-center justify-center p-2 rounded-full shadow transition ${
                  clothes.favorite
                    ? 'bg-pink-500 text-white hover:brightness-95'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
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
                          onChange={(e) => updateField('name', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 text-sm font-semibold placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2"
                          placeholder="Clothing name"
                        />

                        {/* Editable color */}
                        <input
                          type="text"
                          value={clothes.color}
                          onChange={(e) => updateField('color', e.target.value)}
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
                        ? 'Done editing name and color'
                        : 'Edit name and color'
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
              {/* Type */}
              <div className="md:col-span-2">
                <label className="block text-xs text-slate-600 mb-1">
                  Type
                </label>
                <select
                  value={clothes.type ?? ''}
                  onChange={(e) => updateField('type', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2"
                >
                  <option value="">Select type...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Season */}
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Season
                </label>
                <select
                  value={clothes.season ?? ''}
                  onChange={(e) => updateField('season', e.target.value)}
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
                <label className="block text-xs text-slate-600 mb-1">
                  Size
                </label>
                <select
                  value={clothes.size ?? ''}
                  onChange={(e) => updateField('size', e.target.value)}
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
                <label className="block text-xs text-slate-600 mb-1">
                  Brand
                </label>
                {customBrand ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={clothes.brand ?? ''}
                      onChange={(e) => updateField('brand', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2"
                      placeholder="Type brand name..."
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        updateField('brand', null);
                        setCustomBrand(false);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      ← Pick from saved brands
                    </button>
                  </div>
                ) : (
                  <select
                    value={clothes.brand ?? ''}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setCustomBrand(true);
                        updateField('brand', '');
                      } else updateField('brand', e.target.value);
                    }}
                    className="w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2"
                  >
                    <option value="">Select brand...</option>
                    {brandSuggestions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                    <option value="__custom__">+ Add new brand</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Price
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={clothes.price ?? ''}
                  onChange={(e) =>
                    updateField(
                      'price',
                      e.target.value === '' ? null : Number(e.target.value),
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
                {customMaterial ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={clothes.material ?? ''}
                      onChange={(e) => updateField('material', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2"
                      placeholder="Type material name..."
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        updateField('material', null);
                        setCustomMaterial(false);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      ← Pick from saved materials
                    </button>
                  </div>
                ) : (
                  <select
                    value={clothes.material ?? ''}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setCustomMaterial(true);
                        updateField('material', '');
                      } else updateField('material', e.target.value);
                    }}
                    className="w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2"
                  >
                    <option value="">Select material...</option>
                    {MATERIALS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    {materialSuggestions
                      .filter((m) => !MATERIALS.includes(m))
                      .map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    <option value="__custom__">+ Add new material</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Purchase date
                </label>
                <input
                  type="date"
                  value={purchaseDateValue}
                  onChange={(e) => updateField('purchase_date', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Location
                </label>
                {customLocation ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={clothes.location ?? ''}
                      onChange={(e) => updateField('location', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2"
                      placeholder="e.g. Wardrobe A, Drawer 2"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        updateField('location', null);
                        setCustomLocation(false);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      ← Pick from saved locations
                    </button>
                  </div>
                ) : (
                  <select
                    value={clothes.location ?? ''}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setCustomLocation(true);
                        updateField('location', '');
                      } else updateField('location', e.target.value);
                    }}
                    className="w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2"
                  >
                    <option value="">Select location...</option>
                    {locationSuggestions.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
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
                value={clothes.description ?? ''}
                onChange={(e) => updateField('description', e.target.value)}
                className="w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2 min-h-[80px]"
                placeholder="Extra details about this piece..."
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs text-slate-600 mb-1">Notes</label>
              <textarea
                value={clothes.notes ?? ''}
                onChange={(e) => updateField('notes', e.target.value)}
                className="w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500/70 px-3 py-2 min-h-[80px]"
                placeholder="Care instructions, outfit ideas, where you wore it..."
              />
            </div>
          </div>
        </div>

        {/* SIMILAR ITEMS */}
        {similarItems.length > 0 && (
          <div className="mt-8 p-4 rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-medium text-slate-700">
                Similar items in your wardrobe ({similarItems.length})
              </h3>
              {checkingVisual && (
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-amber-500" />
                </span>
              )}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {similarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => router.push(`/wardrobe/${item.id}`)}
                  className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-slate-200 hover:border-slate-400 transition shrink-0"
                >
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs text-slate-400">?</div>
                  )}
                  <div className="text-left min-w-0">
                    <div className="text-xs font-medium text-slate-700 truncate max-w-[100px]">{item.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {item.similarity >= 1 ? 'Same color' : 'Same family'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {visualResult && (
              <div className={`mt-3 text-[11px] px-2 py-1.5 rounded-lg ${visualResult.is_different ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>
                <span className="font-medium">
                  {visualResult.is_different ? '✓ Different enough' : '⚠ May be redundant'}:
                </span>{' '}
                {visualResult.reasoning}
              </div>
            )}
          </div>
        )}

        {/* ACTIONS */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-end">
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
            className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>

          <button
            onClick={handleUpdate}
            disabled={saving}
            className="bg-black text-white px-6 py-3 rounded-lg hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
      <ConfirmModal
        open={confirmDelete}
        title="Delete item?"
        message="This will permanently remove this clothing item. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        loading={deleting}
      />
    </>
  );
}
