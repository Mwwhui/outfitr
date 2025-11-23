import React from "react";

export interface Category {
  id: string;
  name: string;
  color: string;
  textColor: string;
}

export interface Filters {
  category: string;
  favoritesOnly: boolean;
  search: string;
}

interface WardrobeFiltersProps {
  categories: Category[];
  filters: Filters;
  onChange: (next: Filters) => void;
}

const WardrobeFilters: React.FC<WardrobeFiltersProps> = ({
  categories,
  filters,
  onChange,
}) => {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      {/* Search Bar */}
      <div className="relative w-full sm:max-w-xs">
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search clothes..."
          className="w-full rounded-xl border border-slate-200 pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/50 transition"
        />

        {/* Search Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 3a7.5 7.5 0 006.15 12.65z"
          />
        </svg>
      </div>

      {/* Category + Favourites */}
      <div className="flex flex-wrap items-center gap-3 justify-end">
        {/* Category Select */}
        <select
          value={filters.category}
          onChange={(e) => onChange({ ...filters, category: e.target.value })}
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black/50 transition"
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.name}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* Favourites Toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            id="favoritesOnly"
            type="checkbox"
            checked={filters.favoritesOnly}
            onChange={(e) =>
              onChange({ ...filters, favoritesOnly: e.target.checked })
            }
            className="h-4 w-4 rounded border-slate-300 text-black focus:ring-black"
          />
          <span className="text-sm text-slate-700">Favourites</span>
        </label>
      </div>
    </div>
  );
};

export default WardrobeFilters;
