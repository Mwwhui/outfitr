'use client';
import Image from 'next/image';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import DiyVideoGrid, { VideoResult } from './DiyVideoGrid';

const DIY_TUTORIALS = [
  {
    id: 1,
    title: 'Turn a T-Shirt into a Tote Bag',
    difficulty: 'Easy',
    time: '15 min',
    materials: ['Old T-shirt', 'Scissors'],
    matchTypes: ['Tops', 'T-shirt', 'Tank Top'],
    steps: [
      'Lay the t-shirt flat and cut off the sleeves along the seam.',
      'Cut a wide U-shape at the neckline to create the bag opening.',
      'Turn the shirt inside out and sew (or tie) the bottom hem shut.',
      'Turn right-side out — your tote is ready!',
    ],
    emoji: '👜',
    gradient: 'from-rose-100 to-pink-200',
  },
  {
    id: 2,
    title: 'Distressed Denim Shorts',
    difficulty: 'Easy',
    time: '20 min',
    materials: ['Old jeans', 'Scissors', 'Sandpaper or pumice stone'],
    matchTypes: ['Bottoms', 'Jeans', 'Denim'],
    steps: [
      'Lay the jeans flat and mark the cut line on both legs.',
      'Cut straight across both legs at your desired length.',
      'Use scissors to fray the hem by snipping small vertical cuts.',
      'Rub sandpaper on the thighs and knees for a distressed look.',
      'Wash and dry to enhance the fraying.',
    ],
    emoji: '✂️',
    gradient: 'from-blue-100 to-indigo-200',
  },
  {
    id: 3,
    title: 'Sweater into a Pillow Cover',
    difficulty: 'Medium',
    time: '30 min',
    materials: [
      'Old sweater',
      'Needle & thread or sewing machine',
      'Pillow insert',
    ],
    matchTypes: ['Tops', 'Sweater', 'Knitwear', 'Cardigan'],
    steps: [
      'Cut the sweater body into two equal rectangles slightly larger than your pillow.',
      'Pin the two pieces together (inside out) and sew three sides shut.',
      'Turn right-side out, insert the pillow, and hand-stitch the opening closed.',
    ],
    emoji: '🛋️',
    gradient: 'from-emerald-100 to-teal-200',
  },
  {
    id: 4,
    title: 'Shirt Sleeve Headband',
    difficulty: 'Easy',
    time: '5 min',
    materials: ['Old long-sleeve shirt', 'Scissors'],
    matchTypes: ['Tops', 'Shirt', 'Blouse', 'Button-up'],
    steps: [
      'Cut a 3–4 inch ring from the sleeve of an old shirt.',
      'Fold it into a loop and stretch to fit your head.',
      'Optional: tie a small knot at the front for style.',
    ],
    emoji: '💇',
    gradient: 'from-amber-100 to-orange-200',
  },
  {
    id: 5,
    title: 'Fabric Scrap Bracelet',
    difficulty: 'Easy',
    time: '10 min',
    materials: ['Fabric scraps', 'Scissors', 'Glue or needle & thread'],
    matchTypes: ['Tops', 'Bottoms', 'One-Piece'],
    steps: [
      'Cut fabric into thin strips about 1cm wide.',
      'Braid three strips together tightly.',
      'Tie the ends together to form a bracelet loop.',
      'Trim excess and seal ends with a dab of glue or stitch.',
    ],
    emoji: '📿',
    gradient: 'from-purple-100 to-fuchsia-200',
  },
  {
    id: 6,
    title: 'Button-up to Apron',
    difficulty: 'Medium',
    time: '25 min',
    materials: ['Old button-up shirt', 'Scissors', 'Needle & thread'],
    matchTypes: ['Tops', 'Shirt', 'Button-up', 'Blouse'],
    steps: [
      'Cut off the sleeves and collar of the shirt.',
      'Cut along the side seams from hem to armpit.',
      'Sew a hem along the cut edges to prevent fraying.',
      'Use the shirt&#39;s existing buttons and collar band as the neck strap.',
      'Tie the sleeves around your waist as apron strings.',
    ],
    emoji: '👩‍🍳',
    gradient: 'from-cyan-100 to-sky-200',
  },
  {
    id: 7,
    title: 'Jeans into a Denim Planter',
    difficulty: 'Medium',
    time: '30 min',
    materials: ['Old jeans', 'Scissors', 'Needle & thread', 'Small plant pot'],
    matchTypes: ['Bottoms', 'Jeans', 'Denim'],
    steps: [
      'Cut one pant leg off at the knee.',
      'Stitch the bottom of the leg piece closed to form a tube.',
      'Sew a round base onto the bottom using denim scraps.',
      'Turn right-side out and insert your plant pot.',
      'Fold the top edge down for a finished look.',
    ],
    emoji: '🪴',
    gradient: 'from-lime-100 to-green-200',
  },
  {
    id: 8,
    title: 'Tie-Dye Old Basics',
    difficulty: 'Easy',
    time: '45 min',
    materials: [
      'Old white/light shirt',
      'Fabric dye',
      'Rubber bands',
      'Plastic bag',
    ],
    matchTypes: ['Tops', 'T-shirt', 'Tank Top', 'Shirt', 'Socks'],
    steps: [
      'Wet the shirt and wring out excess water.',
      'Twist and wrap rubber bands around the fabric in your desired pattern.',
      'Apply dye according to package instructions.',
      'Place in a plastic bag and let sit for 6-8 hours (or overnight).',
      'Rinse under cold water until water runs clear, then wash and dry.',
    ],
    emoji: '🌈',
    gradient: 'from-violet-100 to-purple-200',
  },
];

const CURATED_VIDEOS: Record<string, VideoResult[]> = {
  't-shirt upcycling': [
    {
      id: 't-shirt-upcycling',
      title: 'T-Shirt Upcycling Ideas',
      channelTitle: 'YouTube',
      thumbnail: '',
      publishedAt: '',
    },
    {
      id: 't-shirt-to-bag',
      title: 'No-Sew T-Shirt Tote Bag',
      channelTitle: 'YouTube',
      thumbnail: '',
      publishedAt: '',
    },
  ],
  'jeans upcycling': [
    {
      id: 'jeans-upcycling',
      title: 'Creative Jeans Upcycling',
      channelTitle: 'YouTube',
      thumbnail: '',
      publishedAt: '',
    },
    {
      id: 'denim-shorts-diy',
      title: 'DIY Distressed Denim Shorts',
      channelTitle: 'YouTube',
      thumbnail: '',
      publishedAt: '',
    },
  ],
  'sweater upcycling': [
    {
      id: 'sweater-upcycling',
      title: 'Sweater Upcycling Projects',
      channelTitle: 'YouTube',
      thumbnail: '',
      publishedAt: '',
    },
    {
      id: 'sweater-pillow',
      title: 'Sweater to Pillow Cover',
      channelTitle: 'YouTube',
      thumbnail: '',
      publishedAt: '',
    },
  ],
  'shirt upcycling': [
    {
      id: 'shirt-upcycling',
      title: 'Button-Up Shirt Upcycling',
      channelTitle: 'YouTube',
      thumbnail: '',
      publishedAt: '',
    },
    {
      id: 'shirt-apron',
      title: 'Shirt to Apron DIY',
      channelTitle: 'YouTube',
      thumbnail: '',
      publishedAt: '',
    },
  ],
  'dress upcycling': [
    {
      id: 'dress-upcycling',
      title: 'Dress Upcycling Ideas',
      channelTitle: 'YouTube',
      thumbnail: '',
      publishedAt: '',
    },
    {
      id: 'dress-to-skirt',
      title: 'Dress to Skirt Refashion',
      channelTitle: 'YouTube',
      thumbnail: '',
      publishedAt: '',
    },
  ],
  'fabric scrap DIY': [
    {
      id: 'scrap-fabric-diy',
      title: 'Fabric Scrap Projects',
      channelTitle: 'YouTube',
      thumbnail: '',
      publishedAt: '',
    },
    {
      id: 'zero-waste-diy',
      title: 'Zero Waste Fabric DIYs',
      channelTitle: 'YouTube',
      thumbnail: '',
      publishedAt: '',
    },
  ],
};

const SEARCH_TOPICS = [
  {
    label: 'T-shirts',
    query: 't-shirt upcycling',
    matchTypes: ['Tops', 'T-shirt', 'Tank Top'],
  },
  {
    label: 'Jeans',
    query: 'jeans upcycling',
    matchTypes: ['Bottoms', 'Jeans', 'Denim'],
  },
  {
    label: 'Sweaters',
    query: 'sweater upcycling',
    matchTypes: ['Tops', 'Sweater', 'Knitwear', 'Cardigan'],
  },
  {
    label: 'Shirts',
    query: 'shirt upcycling',
    matchTypes: ['Tops', 'Shirt', 'Blouse', 'Button-up'],
  },
  {
    label: 'Dresses',
    query: 'dress upcycling',
    matchTypes: ['One-Piece', 'Dress', 'Jumpsuit'],
  },
  {
    label: 'Accessories',
    query: 'fabric scrap DIY',
    matchTypes: ['Tops', 'Bottoms', 'One-Piece'],
  },
];

interface WardrobeItem {
  id: string;
  name: string;
  type: string;
  image_url: string | null;
}

function loadSet(key: string): Set<number> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSet(key: string, set: Set<number>) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

function loadStepProgress(): Record<number, number[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('diy_step_progress');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStepProgress(progress: Record<number, number[]>) {
  localStorage.setItem('diy_step_progress', JSON.stringify(progress));
}

function countMatching(types: string[], wardrobe: WardrobeItem[]): number {
  return wardrobe.filter((item) =>
    types.some((t) => item.type?.toLowerCase().includes(t.toLowerCase())),
  ).length;
}

function getMatchingItems(
  types: string[],
  wardrobe: WardrobeItem[],
): WardrobeItem[] {
  return wardrobe.filter((item) =>
    types.some((t) => item.type?.toLowerCase().includes(t.toLowerCase())),
  );
}

export default function DiyTutorials() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'guides' | 'videos' | 'saved'>(
    'guides',
  );
  const [expandedTutorial, setExpandedTutorial] = useState<number | null>(null);

  // Wardrobe
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [wardrobeLoading, setWardrobeLoading] = useState(true);

  // Video search
  const [query, setQuery] = useState('');
  const [videos, setVideos] = useState<VideoResult[]>([]);

  // Saves / completion
  const [saved, setSaved] = useState<Set<number>>(() => loadSet('diy_saved'));
  const [completed, setCompleted] = useState<Set<number>>(() =>
    loadSet('diy_completed'),
  );
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [showCompletedOnly, setShowCompletedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<
    'all' | 'Easy' | 'Medium'
  >('all');
  const [timeFilter, setTimeFilter] = useState<number | null>(null);

  // Step progress
  const [stepProgress, setStepProgress] =
    useState<Record<number, number[]>>(loadStepProgress);

  // Celebration confetti
  const [celebrating, setCelebrating] = useState<number | null>(null);

  // Saved videos
  const [savedVideos, setSavedVideos] = useState<Record<string, VideoResult>>(
    () => {
      if (typeof window === 'undefined') return {};
      try {
        const raw = localStorage.getItem('diy_saved_videos');
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    },
  );

  // Pagination
  const [pageTokens, setPageTokens] = useState<Record<string, string | null>>(
    {},
  );
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch wardrobe
  useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/clothes?user_id=${session.user.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setWardrobe(
            data.map((item: Record<string, unknown>) => ({
              id: item.id as string,
              name: item.name as string,
              type: (item.type as string) || '',
              image_url: (item.image_url as string) || null,
            })),
          );
        }
      })
      .catch(() => {})
      .finally(() => setWardrobeLoading(false));
  }, [session]);

  // Celebration timeout
  useEffect(() => {
    if (celebrating === null) return;
    const t = setTimeout(() => setCelebrating(null), 2500);
    return () => clearTimeout(t);
  }, [celebrating]);

  const doSearch = useCallback(
    async (q: string, append = false) => {
      setQuery(q);

      if (q === 'all') {
        setVideos([]);
        setPageTokens({});
        const queries = SEARCH_TOPICS.map((t) => t.query);
        try {
          const results = await Promise.all(
            queries.map((query) =>
              fetch(`/api/diy/search?q=${encodeURIComponent(query)}`).then(
                (r) => (r.ok ? r.json() : { videos: [] }),
              ),
            ),
          );
          const allVideos = results.flatMap((r) => r.videos || []);
          const newTokens: Record<string, string | null> = {};
          queries.forEach((query, i) => {
            newTokens[query] = results[i]?.nextPageToken || null;
          });
          if (allVideos.length > 0) {
            setVideos(allVideos.slice(0, 20));
            setPageTokens(newTokens);
            return;
          }
        } catch {
          // fall through
        }
        // Fallback: merge curated all
        const curated = queries.flatMap((query) => CURATED_VIDEOS[query] || []);
        setVideos(curated.slice(0, 20));
        return;
      }

      if (append) {
        const token = pageTokens[q];
        if (!token) return;
        setLoadingMore(true);
        try {
          const res = await fetch(
            `/api/diy/search?q=${encodeURIComponent(q)}&pageToken=${token}`,
          );
          if (res.ok) {
            const data = await res.json();
            if (data.videos?.length > 0) {
              setVideos((prev) => [...prev, ...data.videos]);
              setPageTokens((prev) => ({
                ...prev,
                [q]: data.nextPageToken || null,
              }));
            }
          }
        } catch {
          // silently fail
        } finally {
          setLoadingMore(false);
        }
        return;
      }

      setVideos([]);
      try {
        const res = await fetch(`/api/diy/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.videos?.length > 0) {
            setVideos(data.videos);
            setPageTokens((prev) => ({
              ...prev,
              [q]: data.nextPageToken || null,
            }));
            return;
          }
        }
      } catch {
        // fall through to curated
      }
      setVideos(CURATED_VIDEOS[q] || []);
      setPageTokens((prev) => ({ ...prev, [q]: null }));
    },
    [pageTokens],
  );

  // Auto-search on video tab switch
  useEffect(() => {
    if (activeTab !== 'videos' || query !== '') return;
    doSearch('all');
  }, [activeTab, doSearch, query]);

  const toggleSaved = (id: number) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveSet('diy_saved', next);
      return next;
    });
  };

  const toggleCompleted = (id: number) => {
    const next = new Set(completed);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      setCelebrating(id);
    }
    setCompleted(next);
    saveSet('diy_completed', next);
  };

  const toggleStep = (tutorialId: number, stepIndex: number) => {
    setStepProgress((prev) => {
      const current = prev[tutorialId] || [];
      const next = current.includes(stepIndex)
        ? current.filter((i) => i !== stepIndex)
        : [...current, stepIndex].sort();
      const updated = { ...prev, [tutorialId]: next };
      saveStepProgress(updated);
      return updated;
    });
  };

  const toggleSavedVideo = (id: string, video: VideoResult) => {
    setSavedVideos((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = video;
      localStorage.setItem('diy_saved_videos', JSON.stringify(next));
      return next;
    });
  };

  const loadMore = useCallback(() => {
    if (query && query !== 'all' && pageTokens[query]) {
      doSearch(query, true);
    }
  }, [query, pageTokens, doSearch]);

  const filteredTutorials = DIY_TUTORIALS.filter((t) => {
    if (showSavedOnly && !saved.has(t.id)) return false;
    if (showCompletedOnly && !completed.has(t.id)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = t.title.toLowerCase().includes(q);
      const matchesMaterials = t.materials.some((m) =>
        m.toLowerCase().includes(q),
      );
      const matchesDifficulty = t.difficulty.toLowerCase().includes(q);
      if (!matchesTitle && !matchesMaterials && !matchesDifficulty)
        return false;
    }
    if (difficultyFilter !== 'all' && t.difficulty !== difficultyFilter)
      return false;
    if (timeFilter !== null) {
      const mins = parseInt(t.time);
      if (isNaN(mins) || mins > timeFilter) return false;
    }
    return true;
  });

  useEffect(() => {
    setExpandedTutorial(null);
  }, [showSavedOnly, showCompletedOnly]);

  const tabs = [
    { key: 'guides' as const, label: 'Written Guides' },
    { key: 'videos' as const, label: 'Video Tutorials' },
    {
      key: 'saved' as const,
      label: `Saved (${saved.size + Object.keys(savedVideos).length})`,
    },
  ];

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-[#163422]">
          DIY Upcycling Tutorials
        </h3>
        {activeTab === 'guides' && wardrobe.length > 0 && (
          <p className="text-xs text-on-surface-variant/60">
            {wardrobe.length} items in wardrobe
          </p>
        )}
      </div>

      <div className="flex gap-1 mb-6 p-1 bg-gray-100 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-[#0f172a] shadow-sm'
                : 'text-on-surface-variant/60 hover:text-[#0f172a]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ──────── Written Guides Tab ──────── */}
      {activeTab === 'guides' && (
        <div>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <button
              onClick={() => {
                setShowSavedOnly(false);
                setShowCompletedOnly(false);
              }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                !showSavedOnly && !showCompletedOnly
                  ? 'bg-[#0f172a] text-white border-[#0f172a]'
                  : 'bg-white text-on-surface-variant/60 border-gray-200 hover:border-gray-300'
              }`}
            >
              All ({DIY_TUTORIALS.length})
            </button>
            <button
              onClick={() => {
                setShowSavedOnly(true);
                setShowCompletedOnly(false);
              }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition flex items-center gap-1 ${
                showSavedOnly
                  ? 'bg-[#0f172a] text-white border-[#0f172a]'
                  : 'bg-white text-on-surface-variant/60 border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                bookmark
              </span>
              Saved ({saved.size})
            </button>
            <button
              onClick={() => {
                setShowSavedOnly(false);
                setShowCompletedOnly(true);
              }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition flex items-center gap-1 ${
                showCompletedOnly
                  ? 'bg-[#0f172a] text-white border-[#0f172a]'
                  : 'bg-white text-on-surface-variant/60 border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                check_circle
              </span>
              Done ({completed.size})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative mb-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 material-symbols-outlined text-sm">
              search
            </span>
            <input
              type="text"
              placeholder="Search tutorials by title, material, or difficulty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-8 pr-4 text-sm text-gray-800 focus:outline-none focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a] transition"
            />
          </div>

          {/* Difficulty & time filters */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs text-on-surface-variant/50 font-medium">
              Difficulty:
            </span>
            {(['all', 'Easy', 'Medium'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficultyFilter(d)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition ${
                  difficultyFilter === d
                    ? 'bg-[#0f172a] text-white border-[#0f172a]'
                    : 'bg-white text-on-surface-variant/60 border-gray-200 hover:border-gray-300'
                }`}
              >
                {d === 'all' ? 'Any' : d}
              </button>
            ))}
            <span className="text-xs text-on-surface-variant/50 font-medium ml-1">
              Time:
            </span>
            {[
              { label: 'Any', value: null },
              { label: '<15m', value: 15 },
              { label: '<30m', value: 30 },
            ].map((t) => (
              <button
                key={t.label}
                onClick={() => setTimeFilter(t.value)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition ${
                  timeFilter === t.value
                    ? 'bg-[#0f172a] text-white border-[#0f172a]'
                    : 'bg-white text-on-surface-variant/60 border-gray-200 hover:border-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
            {(searchQuery ||
              difficultyFilter !== 'all' ||
              timeFilter !== null) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDifficultyFilter('all');
                  setTimeFilter(null);
                }}
                className="text-xs font-medium text-primary ml-1 hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          {filteredTutorials.length === 0 ? (
            <div className="text-center py-12 text-on-surface-variant/60">
              <span className="material-symbols-outlined text-4xl mb-2">
                search
              </span>
              <p className="text-sm font-medium">
                No tutorials match your search
              </p>
              <p className="text-xs mt-1">
                Bookmark tutorials to find them here
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              {filteredTutorials.map((tutorial) => {
                const matchedCount = countMatching(
                  tutorial.matchTypes,
                  wardrobe,
                );
                const matchingItems = getMatchingItems(
                  tutorial.matchTypes,
                  wardrobe,
                );
                const isSaved = saved.has(tutorial.id);
                const isCompleted = completed.has(tutorial.id);
                const completedSteps = stepProgress[tutorial.id] || [];
                const totalSteps = tutorial.steps.length;
                const progressPct =
                  totalSteps > 0
                    ? Math.round((completedSteps.length / totalSteps) * 100)
                    : 0;
                const isCelebrating = celebrating === tutorial.id;

                return (
                  <div
                    key={tutorial.id}
                    className={`break-inside-avoid bg-white rounded-2xl border hover:shadow-md transition-all duration-200 ${
                      isCompleted ? 'border-green-300' : 'border-gray-200'
                    } ${expandedTutorial === tutorial.id ? '' : 'overflow-hidden'}`}
                  >
                    {/* ── Gradient Hero Header ── */}
                    <button
                      className="w-full text-left"
                      onClick={() =>
                        setExpandedTutorial(
                          expandedTutorial === tutorial.id ? null : tutorial.id,
                        )
                      }
                    >
                      <div
                        className={`bg-gradient-to-br ${tutorial.gradient} px-5 pt-5 pb-4`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-4xl">{tutorial.emoji}</span>
                          <div className="flex items-center gap-1.5">
                            {isSaved && (
                              <span className="material-symbols-outlined text-sm text-amber-600">
                                bookmark
                              </span>
                            )}
                            {isCompleted && (
                              <span className="material-symbols-outlined text-sm text-green-600">
                                check_circle
                              </span>
                            )}
                            <span className="text-gray-400 text-base">
                              {expandedTutorial === tutorial.id ? '▲' : '▼'}
                            </span>
                          </div>
                        </div>
                        <h4 className="font-bold text-[#0f172a] text-lg mt-2 leading-tight">
                          {tutorial.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                          <span className="text-[11px] font-semibold bg-white/70 text-gray-700 px-2 py-0.5 rounded-full">
                            {tutorial.difficulty}
                          </span>
                          <span className="text-[11px] font-semibold bg-white/70 text-gray-700 px-2 py-0.5 rounded-full">
                            ⏱ {tutorial.time}
                          </span>
                          {!wardrobeLoading && matchedCount > 0 && (
                            <span className="text-[11px] font-semibold bg-white/70 text-[#2f4d39] px-2 py-0.5 rounded-full">
                              {matchedCount} items
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* ── Expanded Content ── */}
                    {expandedTutorial === tutorial.id && (
                      <div className="px-5 pb-5">
                        <div className="mt-4 space-y-4">
                          {/* Action buttons */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSaved(tutorial.id);
                              }}
                              className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                                isSaved
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-white text-on-surface-variant/60 border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <span className="material-symbols-outlined text-sm">
                                {isSaved ? 'bookmark' : 'bookmark_border'}
                              </span>
                              {isSaved ? 'Saved' : 'Save'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCompleted(tutorial.id);
                              }}
                              className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                                isCompleted
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : 'bg-white text-on-surface-variant/60 border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <span className="material-symbols-outlined text-sm">
                                {isCompleted
                                  ? 'check_circle'
                                  : 'radio_button_unchecked'}
                              </span>
                              {isCompleted ? 'Done' : 'Mark done'}
                            </button>
                          </div>

                          {/* Materials */}
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                              Materials
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {tutorial.materials.map((m) => (
                                <span
                                  key={m}
                                  className="text-xs bg-[#d4e9c4] text-[#2f4d39] px-2.5 py-1 rounded-full"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Wardrobe mini-display */}
                          {!wardrobeLoading && matchingItems.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                From your wardrobe
                              </p>
                              <div className="flex items-center gap-2.5">
                                <div className="flex -space-x-2">
                                  {matchingItems.slice(0, 3).map((item) => (
                                    <div
                                      key={item.id}
                                      className="w-9 h-9 rounded-full border-2 border-white bg-gray-100 overflow-hidden shrink-0 relative"
                                    >
                                      {item.image_url ? (
                                        <Image
                                          fill
                                          src={item.image_url}
                                          alt={item.name}
                                          className="object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                                          {item.name[0]}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                  {matchingItems.length > 3 && (
                                    <div className="w-9 h-9 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] font-semibold text-gray-500 shrink-0">
                                      +{matchingItems.length - 3}
                                    </div>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500">
                                  {matchingItems.length} item
                                  {matchingItems.length > 1 ? 's' : ''} fit this
                                  tutorial
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Steps with checkbox progress */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Steps
                              </p>
                              {totalSteps > 0 && (
                                <span className="text-[10px] text-gray-400 font-medium">
                                  {completedSteps.length}/{totalSteps}
                                </span>
                              )}
                            </div>

                            {/* Progress bar */}
                            {completedSteps.length > 0 && (
                              <div className="w-full h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-300"
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                            )}

                            <ol className="space-y-1.5">
                              {tutorial.steps.map((step, i) => {
                                const done = completedSteps.includes(i);
                                return (
                                  <li key={i}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleStep(tutorial.id, i);
                                      }}
                                      className={`w-full flex items-start gap-2.5 text-left p-2 rounded-xl transition ${
                                        done
                                          ? 'bg-green-50/50'
                                          : 'hover:bg-gray-50'
                                      }`}
                                    >
                                      <span
                                        className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                          done
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-200 text-gray-500'
                                        }`}
                                      >
                                        {done ? (
                                          <span className="material-symbols-outlined text-sm">
                                            check
                                          </span>
                                        ) : (
                                          i + 1
                                        )}
                                      </span>
                                      <span
                                        className={`text-sm leading-snug transition ${
                                          done
                                            ? 'text-gray-400 line-through'
                                            : 'text-gray-700'
                                        }`}
                                        dangerouslySetInnerHTML={{
                                          __html: step,
                                        }}
                                      />
                                    </button>
                                  </li>
                                );
                              })}
                            </ol>

                            {progressPct === 100 && !isCompleted && (
                              <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                                <p className="text-xs font-semibold text-green-700">
                                  All steps done! Mark this tutorial as complete
                                  above.
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Celebration on completion */}
                          {isCelebrating && (
                            <div className="relative">
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="flex gap-1">
                                  {['🎉', '✨', '🌍', '🎊'].map((emoji, i) => (
                                    <span
                                      key={emoji}
                                      className="text-xl animate-bounce"
                                      style={{
                                        animationDelay: `${i * 0.15}s`,
                                        animationDuration: '0.6s',
                                      }}
                                    >
                                      {emoji}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 text-center">
                                <p className="text-xs font-semibold text-green-700">
                                  You saved an item from landfill! 🌍
                                </p>
                                <p className="text-[11px] text-green-600 mt-0.5">
                                  ~2.5 kg CO₂e saved by extending this
                                  garment&apos;s life
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ──────── Video Tutorials Tab ──────── */}
      {activeTab === 'videos' && (
        <div>
          <div className="flex flex-wrap gap-2 mb-5">
            <button
              onClick={() => doSearch('all')}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full border transition ${
                query === 'all'
                  ? 'bg-[#0f172a] text-white border-[#0f172a]'
                  : 'bg-white text-on-surface-variant/60 border-gray-200 hover:border-gray-300'
              }`}
            >
              All
              {!wardrobeLoading && (
                <span className="text-[10px] opacity-60">
                  {SEARCH_TOPICS.reduce(
                    (s, t) => s + countMatching(t.matchTypes, wardrobe),
                    0,
                  )}
                </span>
              )}
            </button>
            {SEARCH_TOPICS.map((topic) => {
              const matchedCount = countMatching(topic.matchTypes, wardrobe);
              return (
                <button
                  key={topic.query}
                  onClick={() => doSearch(topic.query)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full border transition ${
                    query === topic.query
                      ? 'bg-[#0f172a] text-white border-[#0f172a]'
                      : 'bg-white text-on-surface-variant/60 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {topic.label}
                  {!wardrobeLoading && (
                    <span className="text-[10px] opacity-60">
                      {matchedCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <DiyVideoGrid
            videos={videos}
            loading={false}
            savedVideoIds={new Set(Object.keys(savedVideos))}
            onToggleSave={toggleSavedVideo}
            onLoadMore={
              query !== 'all' && pageTokens[query] ? loadMore : undefined
            }
            hasMore={query !== 'all' && !!pageTokens[query]}
            loadingMore={loadingMore}
          />

          {/* Wardrobe match for single category */}
          {query !== 'all' &&
            (() => {
              const activeTopic = SEARCH_TOPICS.find((t) => t.query === query);
              if (!activeTopic) return null;
              const matchingItems = getMatchingItems(
                activeTopic.matchTypes,
                wardrobe,
              );
              if (matchingItems.length === 0) return null;
              return (
                <div className="mt-6 p-4 bg-white rounded-2xl border border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    From your wardrobe
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {matchingItems.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="w-10 h-10 rounded-full border-2 border-white bg-gray-100 overflow-hidden shrink-0 relative"
                        >
                          {item.image_url ? (
                            <Image
                              fill
                              src={item.image_url}
                              alt={item.name}
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                              {item.name[0]}
                            </div>
                          )}
                        </div>
                      ))}
                      {matchingItems.length > 3 && (
                        <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500 shrink-0">
                          +{matchingItems.length - 3}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#0f172a]">
                        {matchingItems.length} item
                        {matchingItems.length > 1 ? 's' : ''} in your wardrobe
                      </p>
                      <p className="text-xs text-on-surface-variant/60 mt-0.5">
                        Could work for {activeTopic.label.toLowerCase()}{' '}
                        projects
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>
      )}

      {/* ──────── Saved Tab ──────── */}
      {activeTab === 'saved' && (
        <div>
          {/* Saved written guides */}
          {saved.size > 0 && (
            <div className="mb-8">
              <h4 className="text-sm font-bold text-[#163422] mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">book</span>
                Written Guides ({saved.size})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {DIY_TUTORIALS.filter((t) => saved.has(t.id)).map(
                  (tutorial) => {
                    const matchedCount = countMatching(
                      tutorial.matchTypes,
                      wardrobe,
                    );
                    const isCompleted = completed.has(tutorial.id);
                    return (
                      <div
                        key={tutorial.id}
                        className={`break-inside-avoid bg-white rounded-2xl border hover:shadow-md transition-shadow overflow-hidden ${
                          isCompleted ? 'border-green-300' : 'border-gray-200'
                        }`}
                      >
                        <div
                          className={`bg-gradient-to-br ${tutorial.gradient} px-4 py-3`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{tutorial.emoji}</span>
                            <div className="min-w-0">
                              <p className="font-semibold text-[#0f172a] text-sm leading-snug">
                                {tutorial.title}
                                {isCompleted && (
                                  <span className="ml-1 text-green-600">✓</span>
                                )}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] bg-white/70 text-gray-600 px-1.5 py-0.5 rounded-full">
                                  {tutorial.difficulty} · {tutorial.time}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          )}

          {/* Saved videos */}
          {Object.keys(savedVideos).length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-[#163422] mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">
                  smart_display
                </span>
                Videos ({Object.keys(savedVideos).length})
              </h4>
              <DiyVideoGrid
                videos={Object.values(savedVideos)}
                loading={false}
                savedVideoIds={new Set(Object.keys(savedVideos))}
                onToggleSave={toggleSavedVideo}
              />
            </div>
          )}

          {/* Empty state */}
          {saved.size === 0 && Object.keys(savedVideos).length === 0 && (
            <div className="text-center py-12 text-on-surface-variant/60">
              <span className="material-symbols-outlined text-4xl mb-2">
                bookmark
              </span>
              <p className="text-sm font-medium">No saved items yet</p>
              <p className="text-xs mt-1">
                Bookmark written guides or videos to find them here
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
