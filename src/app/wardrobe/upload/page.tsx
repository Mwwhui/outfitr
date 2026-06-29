'use client';

import { useState, useEffect, useReducer, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Category,
  SEASONS,
  SIZES,
  MATERIALS,
  ColorSource,
  GEMINI_TIMEOUT_MS,
  inputBase,
  compressImage,
  detectSeason,
  fetchWithTimeout,
} from './upload-utils';
import { useCameraScanner } from './useCameraScanner';
import CameraViewfinder from './CameraViewfinder';
import EditItemsModal from './EditItemsModal';

interface FormFields {
  name: string;
  type: string;
  color: string;
  season: string | '';
  size: string | '';
  brand: string;
  price: string;
  material: string | '';
  purchaseDate: string;
  location: string | '';
  description: string;
  notes: string;
  useCases: string[];
}

const initialForm: FormFields = {
  name: '',
  type: '',
  color: '',
  season: '',
  size: '',
  brand: '',
  price: '',
  material: '',
  purchaseDate: new Date().toISOString().split('T')[0],
  location: '',
  description: '',
  notes: '',
  useCases: [],
};

function formReducer(state: FormFields, next: Partial<FormFields>): FormFields {
  return { ...state, ...next };
}

function useSuggestions(userId: string | undefined) {
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [materialSuggestions, setMaterialSuggestions] = useState<string[]>([]);

  useEffect(() => {
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
  }, [userId]);

  return { brandSuggestions, locationSuggestions, materialSuggestions };
}

export default function UploadClothesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [fields, setField] = useReducer(formReducer, initialForm);

  const [customBrand, setCustomBrand] = useState(false);
  const [customMaterial, setCustomMaterial] = useState(false);
  const [customLocation, setCustomLocation] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectResult, setDetectResult] = useState<{
    type: string;
    confidence: number;
    color: string | null;
    source: ColorSource | null;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formError, setFormError] = useState('');
  const [similarItems, setSimilarItems] = useState<Array<{id: string; name: string; color: string | null; image_url: string | null; similarity: number}>>([]);
  const [checkingSimilar, setCheckingSimilar] = useState(false);
  const [visualResult, setVisualResult] = useState<{is_different: boolean; reasoning: string; confidence: number} | null>(null);
  const [similarDismissed, setSimilarDismissed] = useState(false);
  const [useCaseDetected, setUseCaseDetected] = useState(false);

  const { brandSuggestions, locationSuggestions, materialSuggestions } =
    useSuggestions(session?.user?.id);

  const cam = useCameraScanner();
  const fileKeyRef = useRef('');
  const compressedCacheRef = useRef<{ key: string; file: File } | null>(null);

  // Fetch categories on mount
  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // Auto-detect for file upload
  useEffect(() => {
    if (!imageFile) return;
    const key = `${imageFile.name}|${imageFile.size}|${imageFile.lastModified}`;
    if (key === fileKeyRef.current) return;
    fileKeyRef.current = key;
    let active = true;
    const abortController = new AbortController();

    const detect = async () => {
      setDetecting(true);
      setDetectResult(null);
      setUseCaseDetected(false);
      try {
        const compressed = await compressImage(imageFile);
        compressedCacheRef.current = { key, file: compressed };
        // Each fetch needs its own FormData — a body can only be read once
        const fdYolo = new FormData();
        fdYolo.append('file', compressed);
        const fdGemini = new FormData();
        fdGemini.append('file', compressed);
        const fdUseCase = new FormData();
        fdUseCase.append('file', compressed);

        const [yoloData, geminiData, useCaseData] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_YOLO_API_URL}/auto-detect`, {
            method: 'POST',
            body: fdYolo,
            signal: abortController.signal,
          }).then((r) => {
            if (!r.ok) throw new Error('YOLO API error');
            return r.json();
          }).catch((err) => {
            console.error('YOLO detection failed:', err);
            return null;
          }),
          fetchWithTimeout('/api/clothes/detect-color', {
            method: 'POST',
            body: fdGemini,
            signal: abortController.signal,
          }, GEMINI_TIMEOUT_MS).then((r) => {
            if (!r.ok) throw new Error('Gemini API error');
            return r.json();
          }).catch((err) => {
            console.error('Gemini color detection failed:', err);
            return null;
          }),
          fetchWithTimeout('/api/clothes/detect-use-case', {
            method: 'POST',
            body: fdUseCase,
            signal: abortController.signal,
          }, GEMINI_TIMEOUT_MS).then((r) => {
            if (!r.ok) throw new Error('Use case API error');
            return r.json();
          }).catch((err) => {
            console.error('Use case detection failed:', err);
            return null;
          }),
        ]);

        if (!active) return;

        const detectedColor = geminiData?.color || yoloData?.color || '';
        const detectedType = yoloData?.type || '';
        const confidence = yoloData?.confidence || 0;
        const colorSource: ColorSource = geminiData?.color ? "gemini" : yoloData?.color ? "yolo" : "hsv";

        let yoloType = '';
        try {
          const fd2 = new FormData();
          fd2.append('file', compressed);
          const detRes = await fetch(
            `${process.env.NEXT_PUBLIC_YOLO_API_URL}/detect`,
            { method: 'POST', body: fd2, signal: abortController.signal },
          );
          const detData = await detRes.json();
          if (active) {
            yoloType = detData.items?.[0]?.yolo_type || '';
          }
        } catch {
          /* ignore yolo-detect failure */
        }

        const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
        const title = (s: string) => s.split(' ').map(cap).join(' ');

        const specificName = yoloType || detectedType;
        const desc = title(specificName);

        if (detectedType) {
          setField({ type: detectedType });
          const seasonGuess = detectSeason(specificName, detectedType);
          if (seasonGuess) setField({ season: seasonGuess });
        }

        if (detectedColor) {
          setField({ color: detectedColor });
        }

        if (useCaseData?.use_case && useCaseData.use_case.length > 0) {
          setField({ useCases: useCaseData.use_case });
          setUseCaseDetected(true);
        }

        const label = [detectedColor, specificName].filter(Boolean).map(title).join(' ');
        if (label) setField({ name: label });

        if (desc) {
          setDetectResult({
            type: desc,
            confidence,
            color: detectedColor || null,
            source: colorSource,
          });
          setTimeout(() => {
            if (active) setDetectResult(null);
          }, 4000);
        }
      } catch (e) {
        if (e instanceof Error && e.name !== 'AbortError') {
          console.error('Auto-detect failed:', e);
        } else if (!(e instanceof Error)) {
          console.error('Auto-detect failed:', e);
        }
      } finally {
        if (active) setDetecting(false);
      }
    };
    detect();
    return () => {
      active = false;
      abortController.abort();
    };
  }, [imageFile]);

  // Check for similar items after type + color settle
  useEffect(() => {
    if (!session?.user?.id || !fields.type) return;
    let active = true;
    setSimilarDismissed(false);
    setVisualResult(null);

    const check = async () => {
      setCheckingSimilar(true);
      setSimilarItems([]);
      try {
        const params = new URLSearchParams({
          user_id: session.user.id,
          type: fields.type,
        });
        if (fields.color) params.set('color', fields.color);
        const res = await fetch(`/api/clothes/similar?${params}`);
        if (!res.ok || !active) return;
        const data = await res.json();
        if (!active) return;
        setSimilarItems(data.similar || []);

        // Tier 2: If 1-3 matches, fire Gemini visual comparison (use cached compressed image)
        if (data.similar?.length >= 1 && data.similar.length <= 3 && !similarDismissed && active) {
          try {
            // Reuse cached compressed image from auto-detect, or compress fresh
            let compressed = compressedCacheRef.current?.file;
            if (!compressed && imageFile) {
              compressed = await compressImage(imageFile);
            }
            if (!compressed || !active) return;
            const imageBase64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve((reader.result as string).split(',')[1]);
              reader.readAsDataURL(compressed!);
            });
            if (!active) return;
            const visRes = await fetch('/api/clothes/visual-similarity', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                new_image: imageBase64,
                existing_images: data.similar.map((s: { id: string; image_url: string; name: string }) => ({
                  id: s.id,
                  image_url: s.image_url,
                  name: s.name,
                })),
                type: fields.type,
              }),
            });
            if (visRes.ok && active) {
              setVisualResult(await visRes.json());
            }
          } catch {
            // Visual comparison is optional, ignore errors
          }
        }
      } catch {
        // Ignore errors
      } finally {
        if (active) setCheckingSimilar(false);
      }
    };

    const timer = setTimeout(check, 800);
    return () => { active = false; clearTimeout(timer); };
  }, [fields.type, fields.color, session?.user?.id, imageFile]);

  // Clean up blob URLs
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleImageChange = (file: File | null) => {
    setImageFile(file);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const errorMsg = cam.cameraError || formError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) {
      setFormError('You must be logged in.');
      return;
    }
    if (!imageFile) {
      setFormError('Please select an image.');
      return;
    }
    if (!fields.name.trim()) {
      setFormError('Please enter a name.');
      return;
    }

    if (fields.useCases.length === 0) {
      setFormError('Please select at least one use case (e.g. casual, business, sleepwear).');
      return;
    }

    setIsUploading(true);
    setFormError('');

    try {
      const compressed = compressedCacheRef.current?.file || await compressImage(imageFile);
      const formData = new FormData();
      formData.append('file', compressed);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');
      const imageUrl = uploadData.url;

      const saveRes = await fetch('/api/clothes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: session.user.id,
          name: fields.name,
          type: fields.type,
          color: fields.color,
          season: fields.season || null,
          size: fields.size || null,
          brand: fields.brand || null,
          price: fields.price === '' ? null : Number(fields.price),
          material: fields.material || null,
          favorite: false,
          image_url: imageUrl,
          use_case: fields.useCases,
          description: fields.description || null,
          purchase_date: fields.purchaseDate || null,
          location: fields.location || null,
          notes: fields.notes || null,
        }),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error || 'Failed to save clothing');
      }
      router.push('/wardrobe');
    } catch (err) {
      console.error(err);
      setFormError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleUseCase = (value: string) => {
    setField({
      useCases: fields.useCases.includes(value)
        ? fields.useCases.filter((v) => v !== value)
        : [...fields.useCases, value],
    });
  };

  const USE_CASE_LABELS: Record<string, string> = {
    casual: 'Casual',
    business: 'Business',
    sport: 'Sport',
    sleep: 'Sleepwear',
    swim: 'Swimwear',
    date: 'Date Night',
  };

  const upd =
    (key: keyof FormFields) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setField({ [key]: e.target.value });

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        ← Back
      </button>

      <h1 className="text-3xl font-bold mb-6 font-headline">Add New Clothing</h1>

      {errorMsg && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
          {errorMsg}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)]"
      >
        <div className="space-y-4 h-full">
          <input
            id="imageUpload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
          />

          <button
            type="button"
            onClick={cam.startCamera}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm hover:bg-slate-50 w-full"
          >
            📷 Take Photo
          </button>

          <div className="relative rounded-3xl overflow-hidden shadow-sm bg-white">
            <label
              htmlFor="imageUpload"
              className="w-full h-100 bg-slate-100 rounded-b-none overflow-hidden cursor-pointer
                border-b border-slate-200 hover:bg-slate-200 transition flex items-center justify-center"
            >
              {imagePreview ? (
                <div className="relative w-full h-full">
                  <img
                    src={imagePreview}
                    alt={fields.name || 'Clothing preview'}
                    className="w-full h-full object-cover"
                  />
                  {detecting && (
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-white/90 text-xs text-slate-600 px-2.5 py-1.5 rounded-full z-10 shadow-sm backdrop-blur-sm">
                      <span className="relative flex w-1.5 h-1.5">
                        <span className="absolute inline-flex w-full h-full rounded-full bg-slate-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-slate-500" />
                      </span>
                      <span className="tracking-wider font-medium">
                        Detecting
                      </span>
                    </div>
                  )}
                  {detectResult && (
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-white/90 text-xs text-slate-600 px-2.5 py-1.5 rounded-full z-10 shadow-sm backdrop-blur-sm animate-in fade-in slide-in-from-top-1 duration-300">
                      <span className="text-amber-500 text-[10px]">✦</span>
                      <span className="font-medium">{detectResult.type}</span>
                      <span
                        className={`font-mono tabular-nums ${
                          detectResult.confidence >= 0.8
                            ? 'text-emerald-600'
                            : detectResult.confidence >= 0.6
                              ? 'text-amber-600'
                              : 'text-red-500'
                        }`}
                      >
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
                      <span>
                        {detectResult.source === 'gemini'
                          ? 'AI detected'
                          : detectResult.source === 'yolo'
                            ? 'YOLO detected'
                            : 'Auto detected'}{' '}
                        at{' '}
                        {Math.round(detectResult.confidence * 100)}% confidence
                      </span>
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
                  <p className="text-[10px] text-slate-300 mt-1">
                    ✦ AI will detect type & color
                  </p>
                </div>
              )}
            </label>

            {similarItems.length > 0 && !similarDismissed && (
              <div className="mx-4 mt-3 p-3 rounded-xl border border-amber-200 bg-amber-50 animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 text-xs text-amber-700">
                    <span className="text-amber-500">✦</span>
                    <span className="font-medium">
                      You already have {similarItems.length} similar {similarItems.length === 1 ? 'item' : 'items'}
                    </span>
                    {checkingSimilar && (
                      <span className="relative flex w-1.5 h-1.5 ml-1">
                        <span className="absolute inline-flex w-full h-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-amber-500" />
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSimilarDismissed(true)}
                    className="text-amber-500 hover:text-amber-700 text-xs shrink-0"
                  >
                    Dismiss
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {similarItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 bg-white rounded-lg px-2 py-1.5 border border-amber-100 shrink-0">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-8 h-8 rounded object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">?</div>
                      )}
                      <div className="text-[11px] min-w-0">
                        <div className="font-medium text-slate-700 truncate">{item.name}</div>
                        <div className="text-slate-400">
                          {item.similarity >= 1 ? 'Same color' : 'Similar'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {visualResult && (
                  <div className={`mt-2 text-[11px] px-2 py-1.5 rounded-lg ${visualResult.is_different ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>
                    <span className="font-medium">
                      {visualResult.is_different ? '✓ Different enough' : '⚠ May be redundant'}:
                    </span>{' '}
                    {visualResult.reasoning}
                  </div>
                )}
              </div>
            )}

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={fields.name}
                  onChange={upd('name')}
                  className={inputBase}
                  placeholder="e.g. White T-Shirt"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-visible">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">
                    Type
                  </label>
                  <select
                    value={fields.type}
                    onChange={upd('type')}
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
                    value={fields.color}
                    onChange={upd('color')}
                    className={inputBase}
                    placeholder="e.g. Black"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-md space-y-6">
          <div>
            <h2 className="text-lg font-semibold font-headline">Details</h2>
            <p className="text-sm text-gray-500">
              Add more information so you can filter and find this piece later.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Season
              </label>
              <select
                value={fields.season}
                onChange={upd('season')}
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
            <div>
              <label className="block text-xs text-slate-600 mb-1">Size</label>
              <select
                value={fields.size}
                onChange={upd('size')}
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
            <div>
              <label className="block text-xs text-slate-600 mb-1">Brand</label>
              {customBrand ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={fields.brand}
                    onChange={upd('brand')}
                    className={inputBase}
                    placeholder="Type brand name..."
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setField({ brand: '' });
                      setCustomBrand(false);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    ← Pick from saved brands
                  </button>
                </div>
              ) : (
                <select
                  value={fields.brand}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setCustomBrand(true);
                      setField({ brand: '' });
                    } else setField({ brand: e.target.value });
                  }}
                  className={inputBase}
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
              <label className="block text-xs text-slate-600 mb-1">Price</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={fields.price}
                onChange={upd('price')}
                className={inputBase}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Material
              </label>
              {customMaterial ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={fields.material}
                    onChange={upd('material')}
                    className={inputBase}
                    placeholder="Type material name..."
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setField({ material: '' });
                      setCustomMaterial(false);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    ← Pick from saved materials
                  </button>
                </div>
              ) : (
                <select
                  value={fields.material}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setCustomMaterial(true);
                      setField({ material: '' });
                    } else setField({ material: e.target.value });
                  }}
                  className={inputBase}
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
                value={fields.purchaseDate}
                onChange={upd('purchaseDate')}
                className={inputBase}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-600 mb-1">
                Location
              </label>
              {customLocation ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={fields.location}
                    onChange={upd('location')}
                    className={inputBase}
                    placeholder="e.g. Wardrobe A, Drawer 2"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setField({ location: '' });
                      setCustomLocation(false);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    ← Pick from saved locations
                  </button>
                </div>
              ) : (
                <select
                  value={fields.location}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setCustomLocation(true);
                      setField({ location: '' });
                    } else setField({ location: e.target.value });
                  }}
                  className={inputBase}
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

          {/* Use Case */}
          <div>
            <label className="block text-xs text-slate-600 mb-2">
              Use case <span className="text-red-400">*</span>
              {detecting && <span className="text-slate-400 font-normal ml-2">AI detecting…</span>}
              {useCaseDetected && <span className="text-emerald-500 font-normal ml-2">✦ AI detected</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(USE_CASE_LABELS).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition ${
                    fields.useCases.includes(value)
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={fields.useCases.includes(value)}
                    onChange={() => toggleUseCase(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <hr className="border-slate-200" />
          <div>
            <label className="block text-xs text-slate-600 mb-1">
              Description
            </label>
            <textarea
              value={fields.description}
              onChange={upd('description')}
              className={`${inputBase} min-h-[80px]`}
              placeholder="Extra details about this piece..."
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Notes</label>
            <textarea
              value={fields.notes}
              onChange={upd('notes')}
              className={`${inputBase} min-h-[80px]`}
              placeholder="Care instructions, outfit ideas, where you wore it..."
            />
          </div>
          <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              onClick={() => router.push('/wardrobe')}
              className="px-6 py-3 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-6 py-3 rounded-lg bg-black text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {isUploading ? 'Uploading...' : 'Save clothing'}
            </button>
          </div>
        </div>
      </form>

      <CameraViewfinder
        cameraMode={cam.cameraMode}
        capturedFrame={cam.capturedFrame}
        scanning={cam.scanning}
        flash={cam.flash}
        readiness={cam.readiness}
        stablePct={cam.stablePct}
        countdownDisplay={cam.countdownDisplay}
        itemCount={cam.itemCount}
        capturing={cam.capturing}
        videoRef={cam.videoRef}
        canvasOverlayRef={cam.canvasOverlayRef}
        onStopCamera={cam.stopCamera}
        onCapture={cam.handleCapture}
      />

      <EditItemsModal
        capturedFrame={cam.capturedFrame}
        editItems={cam.editItems}
        categories={categories}
        saving={cam.saving}
        savingPhase={cam.savingPhase}
        refining={cam.refining}
        editCanvasRef={cam.editCanvasRef}
        onStopCamera={cam.stopCamera}
        onRetake={cam.handleRetake}
        onSave={() => session?.user?.id && cam.handleSave(session.user.id)}
        onEditItemsChange={cam.setEditItems}
      />
    </div>
  );
}
