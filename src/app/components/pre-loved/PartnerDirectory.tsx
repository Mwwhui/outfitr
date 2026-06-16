import { Dispatch, SetStateAction, useState } from 'react';

export interface Partner {
  id: string;
  name: string;
  description: string;
  type: 'donate' | 'sell' | 'recycle';
  address: string;
  lat: number;
  lng: number;
  distance?: string;
  rawDistance?: number;
}

const BADGE_COLORS: Record<string, string> = {
  donate: 'bg-green-100 text-green-800',
  sell: 'bg-blue-100 text-blue-800',
  recycle: 'bg-amber-100 text-amber-800',
};

const BADGE_LABELS: Record<string, string> = {
  donate: 'Donate',
  sell: 'Sell / Trade',
  recycle: 'Recycle',
};

const DISTANCE_OPTIONS = [null, 5, 10, 25, 50] as const;

interface Props {
  filteredPartners: Partner[];
  loadingPartners: boolean;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  maxDistance: number | null;
  setMaxDistance: Dispatch<SetStateAction<number | null>>;
  sortBy: 'distance' | 'name';
  setSortBy: Dispatch<SetStateAction<'distance' | 'name'>>;
  openDrawer: (partner: Partner) => void;
}

export default function PartnerDirectory({
  filteredPartners,
  loadingPartners,
  search,
  setSearch,
  maxDistance,
  setMaxDistance,
  sortBy,
  setSortBy,
  openDrawer,
}: Props) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="lg:col-span-5 bg-white rounded-3xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
      <div className="p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
        <div className="flex justify-between items-end mb-3">
          <div>
            <h3 className="text-lg font-bold text-[#163422]">
              Nearby Partners
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Found {filteredPartners.length} locations{' '}
              {sortBy === 'distance' ? 'nearest first' : 'A–Z'}
            </p>
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="text-sm font-medium flex items-center gap-1 text-[#163422] hover:opacity-70 transition"
          >
            Filter {showFilters ? '▲' : '⚙️'}
          </button>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            🔍
          </span>
          <input
            type="text"
            placeholder="Search by name or zip..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-sm text-gray-800 focus:outline-none focus:border-[#163422] focus:ring-1 focus:ring-[#163422] transition cursor-text"
          />
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Max Distance
              </p>
              <div className="flex gap-2 flex-wrap">
                {DISTANCE_OPTIONS.map((d) => (
                  <button
                    key={d ?? 'any'}
                    onClick={() => setMaxDistance(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      maxDistance === d
                        ? 'bg-[#163422] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {d === null ? 'Any' : `${d} km`}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Sort By
              </p>
              <div className="flex gap-2">
                {(['distance', 'name'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      sortBy === s
                        ? 'bg-[#163422] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {s === 'distance' ? 'Nearest' : 'A–Z'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loadingPartners ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">Fetching partners...</p>
          </div>
        ) : filteredPartners.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-2">🔎</div>
            <p className="text-sm">No partners found</p>
          </div>
        ) : (
          filteredPartners.map((partner) => (
            <div
              key={partner.id}
              className="bg-[#f8fafc] rounded-2xl p-4 border border-gray-200 hover:border-[#163422] transition-colors group"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${BADGE_COLORS[partner.type]}`}
                  >
                    {BADGE_LABELS[partner.type]}
                  </span>
                </div>
                <span className="text-xs font-medium text-[#163422] bg-gray-100 px-2 py-0.5 rounded-md">
                  {partner.distance}
                </span>
              </div>
              <h4 className="font-bold text-[#163422] text-base mb-1">
                {partner.name}
              </h4>
              <p className="text-sm text-gray-500 mb-3 line-clamp-1">
                {partner.description}
              </p>
              <button
                onClick={() => openDrawer(partner)}
                className="w-full py-2 bg-gray-100 text-[#163422] text-sm font-semibold rounded-lg group-hover:bg-[#163422] group-hover:text-white transition-colors"
              >
                Select Partner
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
