import { useState } from 'react';

const DIY_TUTORIALS = [
  {
    id: 1,
    title: 'Turn a T-Shirt into a Tote Bag',
    difficulty: 'Easy',
    time: '15 min',
    materials: ['Old T-shirt', 'Scissors'],
    steps: [
      'Lay the t-shirt flat and cut off the sleeves along the seam.',
      'Cut a wide U-shape at the neckline to create the bag opening.',
      'Turn the shirt inside out and sew (or tie) the bottom hem shut.',
      'Turn right-side out — your tote is ready!',
    ],
    emoji: '👜',
  },
  {
    id: 2,
    title: 'Distressed Denim Shorts',
    difficulty: 'Easy',
    time: '20 min',
    materials: ['Old jeans', 'Scissors', 'Sandpaper or pumice stone'],
    steps: [
      'Lay the jeans flat and mark the cut line on both legs.',
      'Cut straight across both legs at your desired length.',
      'Use scissors to fray the hem by snipping small vertical cuts.',
      'Rub sandpaper on the thighs and knees for a distressed look.',
      'Wash and dry to enhance the fraying.',
    ],
    emoji: '✂️',
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
    steps: [
      'Cut the sweater body into two equal rectangles slightly larger than your pillow.',
      'Pin the two pieces together (inside out) and sew three sides shut.',
      'Turn right-side out, insert the pillow, and hand-stitch the opening closed.',
    ],
    emoji: '🛋️',
  },
  {
    id: 4,
    title: 'Shirt Sleeve Headband',
    difficulty: 'Easy',
    time: '5 min',
    materials: ['Old long-sleeve shirt', 'Scissors'],
    steps: [
      'Cut a 3–4 inch ring from the sleeve of an old shirt.',
      'Fold it into a loop and stretch to fit your head.',
      'Optional: tie a small knot at the front for style.',
    ],
    emoji: '💇',
  },
];

export default function DiyTutorials() {
  const [expandedTutorial, setExpandedTutorial] = useState<number | null>(null);

  return (
    <section>
      <h3 className="text-xl font-bold text-[#163422] mb-4">
        DIY Upcycling Tutorials
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DIY_TUTORIALS.map((tutorial) => (
          <div
            key={tutorial.id}
            className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
          >
            <button
              className="w-full p-5 text-left"
              onClick={() =>
                setExpandedTutorial(
                  expandedTutorial === tutorial.id ? null : tutorial.id,
                )
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{tutorial.emoji}</span>
                  <div>
                    <h4 className="font-semibold text-[#163422] text-base">
                      {tutorial.title}
                    </h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {tutorial.difficulty}
                      </span>
                      <span className="text-xs text-gray-500">
                        ⏱ {tutorial.time}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-gray-400 text-lg mt-1">
                  {expandedTutorial === tutorial.id ? '▲' : '▼'}
                </span>
              </div>
            </button>

            {expandedTutorial === tutorial.id && (
              <div className="px-5 pb-5 border-t border-gray-100">
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Materials
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {tutorial.materials.map((m) => (
                      <span
                        key={m}
                        className="text-xs bg-[#d4e9c4] text-[#2f4d39] px-2 py-1 rounded-full"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Steps
                  </p>
                  <ol className="space-y-2">
                    {tutorial.steps.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm text-gray-700">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#163422] text-white text-xs flex items-center justify-center font-bold">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
