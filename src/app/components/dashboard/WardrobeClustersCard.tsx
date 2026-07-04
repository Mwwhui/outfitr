'use client';

interface ClusterInsight {
  totalValue: number;
  avgWear: number;
  avgPrice: number;
  wearVsAverage: number;
  typeBreakdown: { type: string; count: number; percentage: number }[];
}

interface ClusterGroup {
  id: number;
  label: string;
  color: string;
  size: number;
  insight?: ClusterInsight;
}

interface WardrobeClustersCardProps {
  data: { clusters: ClusterGroup[] } | null;
  loading: boolean;
  error: boolean;
  onRefresh: () => void;
  onViewCluster: (clusterId: number) => void;
}

function InsightRow({
  cluster,
  onViewCluster,
}: {
  cluster: ClusterGroup;
  onViewCluster: (id: number) => void;
}) {
  const { insight, label, color } = cluster;

  const primaryStat = (() => {
    if (!insight) {
      return {
        value: `${cluster.size}`,
        unit: 'items',
        detail: 'Insight unavailable',
      };
    }

    switch (label) {
      case 'Keep in Rotation':
        return {
          value: `${insight.avgWear}`,
          unit: 'avg wears',
          detail: `${Math.round(insight.wearVsAverage)}% vs avg`,
        };
      case 'Save for Occasions':
        return {
          value: `$${insight.totalValue}`,
          unit: 'total value',
          detail: `$${insight.avgPrice} avg each`,
        };
      case 'Ready to Let Go':
        return {
          value: `${100 - insight.wearVsAverage}%`,
          unit: 'less worn',
          detail: 'than your average item',
        };
      default:
        return {
          value: `${cluster.size}`,
          unit: 'items',
          detail: insight ? `$${insight.avgPrice} avg` : 'Insight unavailable',
        };
    }
  })();

  return (
    <div className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
      <span
        className="mt-0.5 w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-offset-1"
        style={{ backgroundColor: color }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold text-[#0f172a]">{label}</span>
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {cluster.size} item{cluster.size > 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-lg font-bold text-[#0f172a]">
            {primaryStat.value}
          </span>
          <span className="text-[11px] text-gray-500">{primaryStat.unit}</span>
          <span className="text-[11px] text-gray-400">
            · {primaryStat.detail}
          </span>
        </div>

        {insight ? (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
            {insight.typeBreakdown.slice(0, 3).map((t) => (
              <span key={t.type} className="text-[11px] text-gray-400">
                {t.type}{' '}
                <span className="font-medium text-gray-500">
                  {t.percentage}%
                </span>
              </span>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-gray-400 mt-1">
            Insight not available yet
          </div>
        )}

        <div className="flex gap-3 mt-1.5">
          <button
            onClick={() => onViewCluster(cluster.id)}
            className="text-[11px] font-medium text-[#163422] hover:underline underline-offset-2"
          >
            View in wardrobe →
          </button>
          {label === 'Ready to Let Go' && (
            <a
              href="/pre-loved"
              className="text-[11px] font-medium text-red-600 hover:underline underline-offset-2"
            >
              Pledge on Pre-Loved →
            </a>
          )}
          {label === 'Save for Occasions' && (
            <a
              href="/planner"
              className="text-[11px] font-medium text-amber-600 hover:underline underline-offset-2"
            >
              Plan an outfit →
            </a>
          )}
          {label === 'Keep in Rotation' && insight.avgWear > 0 && (
            <span className="text-[11px] text-gray-400">Most worn cluster</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WardrobeClustersCard({
  data,
  loading,
  error,
  onRefresh,
  onViewCluster,
}: WardrobeClustersCardProps) {
  const clusters = data?.clusters ?? [];
  const hasClusters = clusters.length > 0;

  if (loading) {
    return (
      <div className="bg-white rounded-3xl shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
          <span className="text-xs text-gray-400">Analyzing clusters…</span>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-3xl shadow-sm p-5">
        <p className="text-xs text-gray-500">
          Could not analyze clusters.{' '}
          <button
            onClick={onRefresh}
            className="underline text-gray-600 hover:text-gray-800"
          >
            Retry
          </button>
        </p>
      </div>
    );
  }

  if (!hasClusters) return null;

  return (
    <div className="bg-white rounded-3xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#163422]">
          Wardrobe Clusters
        </h3>
        <button
          onClick={onRefresh}
          className="text-gray-300 hover:text-gray-500 transition p-0.5"
          aria-label="Refresh"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      <div className="divide-y divide-gray-50">
        {clusters.map((cluster) => (
          <InsightRow
            key={cluster.id}
            cluster={cluster}
            onViewCluster={onViewCluster}
          />
        ))}
      </div>
    </div>
  );
}
