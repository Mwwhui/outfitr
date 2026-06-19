'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface CategoryItem {
  name: string;
  count: number;
  color: string;
}

interface CategoryChartProps {
  data: CategoryItem[];
}

export default function CategoryChart({ data }: CategoryChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No items yet
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="w-60 h-60">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                fontSize: '13px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 mt-2">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-600 whitespace-nowrap">{item.name}</span>
            <span className="font-semibold text-[#0f172a]">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
