import { Dispatch, SetStateAction } from 'react';

export type ActionCategory = 'donate' | 'sell' | 'recycle' | 'diy' | null;

interface Props {
  activeCategory: ActionCategory;
  setActiveCategory: Dispatch<SetStateAction<ActionCategory>>;
}

export default function ActionCategoryCards({
  activeCategory,
  setActiveCategory,
}: Props) {
  const toggleCategory = (category: ActionCategory) => {
    setActiveCategory(activeCategory === category ? null : category);
  };

  return (
    <section>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Donate */}
        <button
          onClick={() => toggleCategory('donate')}
          className={`group relative rounded-3xl p-6 text-left border transition-all duration-300 hover:-translate-y-1 overflow-hidden h-44 focus:outline-none ${
            activeCategory === 'donate'
              ? 'bg-[#163422] border-[#163422] shadow-lg'
              : 'bg-white border-gray-200 hover:shadow-md'
          }`}
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity text-[80px] leading-none">
            🤲
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center text-xl ${activeCategory === 'donate' ? 'bg-white/20' : 'bg-green-100'}`}
            >
              🤲
            </div>
            <div>
              <h3
                className={`text-lg font-bold mb-0.5 ${activeCategory === 'donate' ? 'text-white' : 'text-[#163422]'}`}
              >
                Donate
              </h3>
              <p
                className={`text-xs ${activeCategory === 'donate' ? 'text-white/70' : 'text-gray-500'}`}
              >
                NGOs &amp; Charity Shops
              </p>
            </div>
          </div>
        </button>

        {/* Sell */}
        <button
          onClick={() => toggleCategory('sell')}
          className={`group relative rounded-3xl p-6 text-left border transition-all duration-300 hover:-translate-y-1 overflow-hidden h-44 focus:outline-none ${
            activeCategory === 'sell'
              ? 'bg-[#163422] border-[#163422] shadow-lg'
              : 'bg-white border-gray-200 hover:shadow-md'
          }`}
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity text-[80px] leading-none">
            🏪
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center text-xl ${activeCategory === 'sell' ? 'bg-white/20' : 'bg-blue-100'}`}
            >
              🏪
            </div>
            <div>
              <h3
                className={`text-lg font-bold mb-0.5 ${activeCategory === 'sell' ? 'text-white' : 'text-[#163422]'}`}
              >
                Sell &amp; Trade
              </h3>
              <p
                className={`text-xs ${activeCategory === 'sell' ? 'text-white/70' : 'text-gray-500'}`}
              >
                Consignment &amp; Vintage
              </p>
            </div>
          </div>
        </button>

        {/* Recycle */}
        <button
          onClick={() => toggleCategory('recycle')}
          className={`group relative rounded-3xl p-6 text-left border transition-all duration-300 hover:-translate-y-1 overflow-hidden h-44 focus:outline-none ${
            activeCategory === 'recycle'
              ? 'bg-[#163422] border-[#163422] shadow-lg'
              : 'bg-white border-gray-200 hover:shadow-md'
          }`}
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity text-[80px] leading-none">
            ♻️
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center text-xl ${activeCategory === 'recycle' ? 'bg-white/20' : 'bg-amber-100'}`}
            >
              ♻️
            </div>
            <div>
              <h3
                className={`text-lg font-bold mb-0.5 ${activeCategory === 'recycle' ? 'text-white' : 'text-[#163422]'}`}
              >
                Recycle
              </h3>
              <p
                className={`text-xs ${activeCategory === 'recycle' ? 'text-white/70' : 'text-gray-500'}`}
              >
                Textile Bins &amp; Centers
              </p>
            </div>
          </div>
        </button>

        {/* DIY */}
        <button
          onClick={() => toggleCategory('diy')}
          className={`group relative rounded-3xl p-6 text-left border transition-all duration-300 hover:-translate-y-1 overflow-hidden h-44 focus:outline-none ${
            activeCategory === 'diy'
              ? 'bg-[#163422] border-[#163422] shadow-lg'
              : 'bg-white border-gray-200 hover:shadow-md'
          }`}
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity text-[80px] leading-none">
            🧵
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center text-xl ${activeCategory === 'diy' ? 'bg-white/20' : 'bg-purple-100'}`}
            >
              🧵
            </div>
            <div>
              <h3
                className={`text-lg font-bold mb-0.5 ${activeCategory === 'diy' ? 'text-white' : 'text-[#163422]'}`}
              >
                DIY Lab
              </h3>
              <p
                className={`text-xs ${activeCategory === 'diy' ? 'text-white/70' : 'text-gray-500'}`}
              >
                Upcycle Old Clothes
              </p>
            </div>
          </div>
        </button>
      </div>
    </section>
  );
}
