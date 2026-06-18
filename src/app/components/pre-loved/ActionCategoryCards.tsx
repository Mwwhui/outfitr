import { Dispatch, SetStateAction } from 'react';

export type ActionCategory = 'donate' | 'sell' | 'recycle' | 'diy' | null;

interface Props {
  activeCategory: ActionCategory;
  setActiveCategory: Dispatch<SetStateAction<ActionCategory>>;
}

const ICONS: Record<string, { icon: React.ReactNode; bg: React.ReactNode }> = {
  donate: {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="8" width="18" height="12" rx="2" />
        <path d="M12 8v12" />
        <path d="M3 14h18" />
        <path d="M7 8a3 3 0 1 1 5 3 3 3 0 1 1 5-3" />
      </svg>
    ),
    bg: (
      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="8" width="18" height="12" rx="2" />
        <path d="M12 8v12" />
        <path d="M3 14h18" />
        <path d="M7 8a3 3 0 1 1 5 3 3 3 0 1 1 5-3" />
      </svg>
    ),
  },
  sell: {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
    bg: (
      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
  },
  recycle: {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
      </svg>
    ),
    bg: (
      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
      </svg>
    ),
  },
  diy: {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
    bg: (
      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
};

export default function ActionCategoryCards({
  activeCategory,
  setActiveCategory,
}: Props) {
  const toggleCategory = (category: ActionCategory) => {
    setActiveCategory(activeCategory === category ? null : category);
  };

  const categories: { key: Exclude<ActionCategory, null>; title: string; desc: string; circleBg: string }[] = [
    { key: 'donate', title: 'Donate', desc: 'NGOs & Charity Shops', circleBg: 'bg-amber-100' },
    { key: 'sell', title: 'Sell & Trade', desc: 'Consignment & Vintage', circleBg: 'bg-blue-100' },
    { key: 'recycle', title: 'Recycle', desc: 'Textile Bins & Centers', circleBg: 'bg-green-100' },
    { key: 'diy', title: 'DIY Lab', desc: 'Upcycle Old Clothes', circleBg: 'bg-purple-100' },
  ];

  return (
    <section>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => toggleCategory(cat.key)}
              className={`group relative rounded-3xl p-6 text-left border transition-all duration-300 hover:-translate-y-1 overflow-hidden h-44 focus:outline-none ${
                isActive
                  ? 'bg-[#0f172a] border-[#0f172a] shadow-lg'
                  : 'bg-white border-gray-200 hover:shadow-md'
              }`}
            >
              <div className={`absolute top-0 right-0 p-3 transition-opacity pointer-events-none ${
                    isActive ? 'opacity-30' : 'opacity-10 group-hover:opacity-20'
                  }`}>
                {ICONS[cat.key].bg}
              </div>
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-xl ${
                    isActive ? 'bg-white/20' : cat.circleBg
                  }`}
                >
                  {ICONS[cat.key].icon}
                </div>
                <div>
                  <h3
                    className={`text-lg font-bold mb-0.5 ${
                      isActive ? 'text-white' : 'text-[#163422]'
                    }`}
                  >
                    {cat.title}
                  </h3>
                  <p
                    className={`text-xs ${
                      isActive ? 'text-white/70' : 'text-gray-500'
                    }`}
                  >
                    {cat.desc}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
