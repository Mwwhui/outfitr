'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import KpiCard from '../components/dashboard/KpiCard';
import CategoryChart from '../components/dashboard/CategoryChart';
import PledgeTimeline from '../components/dashboard/PledgeTimeline';
import ItemsAddedChart from '../components/dashboard/ItemsAddedChart';
import TopBrandsChart from '../components/dashboard/TopBrandsChart';
import ImpactCard from '../components/dashboard/ImpactCard';
import WardrobeValueCard from '../components/dashboard/WardrobeValueCard';
import WornItemsCard from '../components/dashboard/WornItemsCard';
import WardrobeClustersCard from '../components/dashboard/WardrobeClustersCard';
import WearingHabitsChart from '../components/dashboard/WearingHabitsChart';

interface DashboardTotals {
  items: number;
  items_this_month: number;
  pledges_total: number;
  pledges_pending: number;
  pledges_accepted: number;
  pledges_fulfilled: number;
  pledges_rejected: number;
  fulfilled_change_pct: number;
  sustainability_rate: number;
}

interface CategoryItem {
  name: string;
  count: number;
  color: string;
}

interface BrandItem {
  name: string;
  count: number;
  color: string;
}

interface MonthlyPoint {
  month: string;
  count: number;
}

interface PledgeMonthPoint {
  month: string;
  pending: number;
  accepted: number;
  fulfilled: number;
}

interface StatusItem {
  status: string;
  count: number;
}

interface ActionTypeItem {
  type: string;
  count: number;
}

interface ActivityItem {
  pledge_id: string;
  partner_name: string;
  action_type: string;
  status: string;
  item_count: number;
  created_at: string;
}

interface ImpactByAction {
  donate: { count: number; co2_kg: number; water_l: number; money: number };
  sell: { count: number; co2_kg: number; water_l: number; money: number };
  recycle: { count: number; co2_kg: number; water_l: number; money: number };
}

interface ImpactData {
  co2_saved_kg: number;
  water_saved_l: number;
  items_diverted: number;
  equivalent_trees: number;
  money_saved: number;
  by_action: ImpactByAction;
}

interface WardrobeValue {
  total_value: number;
  average_value: number;
  items_with_price: number;
  items_without_price: number;
  total_wears: number;
  cost_per_wear: number;
  replacement_saved: number;
}

interface WearMonthPoint {
  month: string;
  wears: number;
  items_worn: number;
}

interface WornItem {
  id: string;
  name: string;
  type: string;
  wear_count: number;
  image_url?: string | null;
}

interface DashboardData {
  totals: DashboardTotals;
  categories: CategoryItem[];
  brands: BrandItem[];
  materials: CategoryItem[];
  items_over_time: MonthlyPoint[];
  pledges_over_time: PledgeMonthPoint[];
  status_breakdown: StatusItem[];
  action_types: ActionTypeItem[];
  recent_activity: ActivityItem[];
  impact: ImpactData;
  wardrobe: WardrobeValue;
  most_worn: WornItem[];
  least_worn: WornItem[];
  wears_over_time: WearMonthPoint[];
  wearing_insight: string;
  this_month_wears: number;
  last_month_wears: number;
  wear_change_pct: number;
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={`bg-white rounded-3xl shadow-sm p-5 animate-pulse ${className || ''}`}
    >
      <div className="h-3 bg-gray-100 rounded w-1/3 mb-4" />
      <div className="h-8 bg-gray-100 rounded w-1/2 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-1/4" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="bg-white rounded-3xl shadow-sm p-5 animate-pulse">
      <div className="h-3 bg-gray-100 rounded w-1/4 mb-6" />
      <div className="h-48 bg-gray-50 rounded-xl flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-300 rounded-full animate-spin" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clusterData, setClusterData] = useState<{
    clusters: {
      id: number;
      label: string;
      color: string;
      size: number;
      insight: {
        totalValue: number;
        avgWear: number;
        avgPrice: number;
        wearVsAverage: number;
        typeBreakdown: { type: string; count: number; percentage: number }[];
      };
    }[];
  } | null>(null);
  const [loadingClusters, setLoadingClusters] = useState(true);
  const [clusterError, setClusterError] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    if (status !== 'authenticated') return;

    setLoading(true);
    setError(null);
    setLoadingClusters(true);
    setClusterError(false);

    fetch('/api/clothes/score-unused', { method: 'POST' })
      .catch(() => {})
      .then(() => fetch('/api/dashboard/stats'))
      .then(async (res) => {
        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ error: 'Failed to load' }));
          throw new Error(err.error || 'Failed to load dashboard');
        }
        return res.json();
      })
      .then((json) => {
        setData(json as DashboardData);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });

    fetch('/api/wardrobe/clusters')
      .then((r) => r.json())
      .then((json) => {
        setClusterData(json);
        setLoadingClusters(false);
      })
      .catch(() => {
        setClusterError(true);
        setLoadingClusters(false);
      });
  }, [status, router]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen">
        <div className="px-6 pt-8 pb-4 max-w-6xl mx-auto">
          <div className="h-8 bg-gray-100 rounded w-40 animate-pulse mb-1" />
          <div className="h-4 bg-gray-100 rounded w-60 animate-pulse" />
        </div>
        <div className="px-6 pb-16 max-w-6xl mx-auto space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-[#0f172a] mb-2 font-headline">
            Could not load dashboard
          </h2>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-black text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const t = data!.totals;

  const emptyWardrobe = t.items === 0;

  const noPledges = t.pledges_total === 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 pt-8 pb-4 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-[#163422] font-headline">Dashboard</h1>
        <p className="text-[#424843] mt-1">
          Your wardrobe analytics at a glance
        </p>
      </div>

      <div className="px-6 pb-16 max-w-6xl mx-auto space-y-6">
        {emptyWardrobe && (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👕</span>
              <div>
                <p className="text-sm font-semibold text-[#0f172a]">
                  Your wardrobe is empty
                </p>
                <p className="text-xs text-gray-500">
                  Add items to unlock wardrobe analytics and category insights
                </p>
              </div>
            </div>
            <Link
              href="/wardrobe/upload"
              className="shrink-0 bg-black text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
            >
              Add Item
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="Total Items"
            value={t.items}
            trend={`+${t.items_this_month} this month`}
            trendDirection={t.items_this_month > 0 ? 'up' : 'neutral'}
            icon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 5 3 9l3 1.5V19h12v-8.5L21 9l-3-4h-2l-1 3h-2l-1-3h-2l-1 3H9L8 5H6z" />
              </svg>
            }
            iconBg="bg-blue-100"
          />
          <KpiCard
            label="Active Pledges"
            value={t.pledges_pending + t.pledges_accepted}
            icon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
            }
            iconBg="bg-amber-100"
            suffix={
              t.pledges_total > 0 ? `of ${t.pledges_total} total` : undefined
            }
          />
          <KpiCard
            label="Fulfilled"
            value={t.pledges_fulfilled}
            trend={
              t.fulfilled_change_pct > 0 ? `+${t.fulfilled_change_pct}%` : '—'
            }
            trendDirection={
              t.fulfilled_change_pct > 0
                ? 'up'
                : t.fulfilled_change_pct < 0
                  ? 'down'
                  : 'neutral'
            }
            icon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            }
            iconBg="bg-green-100"
          />
        </div>

        {!emptyWardrobe && (
          <WardrobeValueCard data={data!.wardrobe} totalItems={t.items} />
        )}

        <WearingHabitsChart
          data={data!.wears_over_time}
          thisMonthWears={data!.this_month_wears}
          lastMonthWears={data!.last_month_wears}
          changePct={data!.wear_change_pct}
          insight={data!.wearing_insight}
          totalItems={t.items}
        />

        {!emptyWardrobe && (
          <WornItemsCard
            mostWorn={data!.most_worn}
            leastWorn={data!.least_worn}
          />
        )}

        <ImpactCard
          sustainabilityRate={t.sustainability_rate}
          totalItems={t.items}
          impact={data!.impact}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {!emptyWardrobe && (
            <div className="bg-white rounded-3xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-[#163422] mb-4 font-headline">
                Wardrobe by Category
              </h3>
              <CategoryChart data={data?.categories || []} />
            </div>
          )}
          <div
            className={`bg-white rounded-3xl shadow-sm p-5 ${emptyWardrobe ? 'lg:col-span-2' : ''}`}
          >
            <h3 className="text-sm font-semibold text-[#163422] mb-4">
              Pledges Over Time
            </h3>
            <div className="flex gap-4 mb-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Pending
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> Accepted
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#163422]" /> Fulfilled
              </span>
            </div>
            {noPledges ? (
              <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                No pledge activity yet
              </div>
            ) : (
              <PledgeTimeline data={data?.pledges_over_time || []} />
            )}
          </div>
        </div>

        {!emptyWardrobe && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-[#163422] mb-4 font-headline">
                Items Added Over Time
              </h3>
              <ItemsAddedChart data={data?.items_over_time || []} />
            </div>
            <div className="bg-white rounded-3xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-[#163422] mb-4 font-headline">
                Top Brands
              </h3>
              <TopBrandsChart data={data?.brands || []} />
            </div>
          </div>
        )}

        {!emptyWardrobe && (
          <WardrobeClustersCard
            data={clusterData}
            loading={loadingClusters}
            error={clusterError}
            onRefresh={() => {
              setLoadingClusters(true);
              setClusterError(false);
              fetch('/api/wardrobe/clusters')
                .then((r) => r.json())
                .then((json) => {
                  setClusterData(json);
                  setLoadingClusters(false);
                })
                .catch(() => {
                  setClusterError(true);
                  setLoadingClusters(false);
                });
            }}
            onViewCluster={(clusterId) =>
              router.push(`/wardrobe?cluster=${clusterId}`)
            }
          />
        )}
      </div>
    </div>
  );
}
