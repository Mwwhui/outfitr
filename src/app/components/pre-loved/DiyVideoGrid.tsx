'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface VideoResult {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  publishedAt: string;
  duration?: string;
}

interface DiyVideoGridProps {
  videos: VideoResult[];
  loading: boolean;
  savedVideoIds?: Set<string>;
  onToggleSave?: (id: string, video: VideoResult) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

function isYouTubeId(id: string): boolean {
  return /^[\w-]{11}$/.test(id);
}

function openYouTubeSearch(query: string) {
  window.open(`https://www.youtube.com/results?q=${encodeURIComponent(query)}+DIY+tutorial`, '_blank', 'noopener');
}

const GRADIENTS = [
  'from-pink-200 to-rose-200',
  'from-blue-200 to-cyan-200',
  'from-green-200 to-emerald-200',
  'from-purple-200 to-violet-200',
  'from-amber-200 to-orange-200',
  'from-teal-200 to-lime-200',
];

export default function DiyVideoGrid({
  videos,
  loading,
  savedVideoIds,
  onToggleSave,
  onLoadMore,
  hasMore,
  loadingMore,
}: DiyVideoGridProps) {
  const [activeVideo, setActiveVideo] = useState<VideoResult | null>(null);

  const handleClick = (video: VideoResult) => {
    if (isYouTubeId(video.id)) {
      setActiveVideo(video);
    } else {
      openYouTubeSearch(video.id);
    }
  };

  const handleSave = (e: React.MouseEvent, video: VideoResult) => {
    e.stopPropagation();
    onToggleSave?.(video.id, video);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl overflow-hidden bg-white border border-gray-200 animate-pulse">
            <div className="aspect-video bg-surface-variant" />
            <div className="p-4 space-y-2">
              <div className="h-3 bg-surface-variant rounded w-3/4" />
              <div className="h-2 bg-surface-variant rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-12 text-on-surface-variant/60">
        <span className="material-symbols-outlined text-4xl mb-2">search</span>
        <p className="text-sm font-medium">No tutorials found</p>
        <p className="text-xs mt-1">Try a different search term above</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {videos.map((video, i) => {
          const isSaved = savedVideoIds?.has(video.id);
          return (
            <button
              key={`${video.id}-${i}`}
              onClick={() => handleClick(video)}
              className="rounded-2xl overflow-hidden bg-white border border-gray-200 hover:border-[#0f172a] transition-colors text-left group relative"
            >
              <div className="aspect-video relative overflow-hidden">
                {video.thumbnail ? (
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} flex flex-col items-center justify-center gap-2 p-4`}>
                    <span className="material-symbols-outlined text-5xl text-white/70">smart_display</span>
                    {!isYouTubeId(video.id) && (
                      <>
                        <p className="text-xs text-white/80 font-medium text-center leading-tight line-clamp-2 max-w-full">
                          {video.title}
                        </p>
                        <span className="text-[10px] text-white/60 font-semibold px-2 py-0.5 rounded-full bg-white/20 mt-1">
                          Search YouTube
                        </span>
                      </>
                    )}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                    <span className="material-symbols-outlined text-2xl text-[#0f172a]">play_arrow</span>
                  </div>
                </div>

                {/* Save button */}
                {onToggleSave && (
                  <div
                    onClick={(e) => handleSave(e, video)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center transition-colors cursor-pointer z-10"
                  >
                    <span className={`material-symbols-outlined text-sm ${
                      isSaved ? 'text-amber-300' : 'text-white/80'
                    }`}>
                      {isSaved ? 'bookmark' : 'bookmark_border'}
                    </span>
                  </div>
                )}
                {video.duration && (
                  <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded leading-tight">
                    {video.duration}
                  </span>
                )}
              </div>
              <div className="p-4">
                <p className="text-sm font-semibold text-[#0f172a] line-clamp-2 leading-snug">
                  {video.title}
                </p>
                <p className="text-xs text-on-surface-variant/60 mt-1.5">
                  {isYouTubeId(video.id) ? video.channelTitle : 'Watch on YouTube →'}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Load more */}
      {hasMore && onLoadMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-[#0f172a] hover:border-gray-300 hover:shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                Loading...
              </span>
            ) : (
              'Load more'
            )}
          </button>
        </div>
      )}

      <AnimatePresence>
        {activeVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setActiveVideo(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="w-full max-w-3xl bg-white rounded-3xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative aspect-video bg-black">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${activeVideo.id}?autoplay=1&rel=0`}
                  title={activeVideo.title}
                  className="absolute inset-0 w-full h-full"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0f172a] leading-snug line-clamp-2">
                      {activeVideo.title}
                    </p>
                    <p className="text-xs text-on-surface-variant/60 mt-1">
                      {activeVideo.channelTitle}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveVideo(null)}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-on-surface-variant hover:bg-gray-200 transition shrink-0"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
