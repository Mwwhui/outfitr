'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
  dashboardStatsOptions,
  useDashboardStats,
} from '@/hooks/queries/dashboard';
import { clustersOptions, useClusters } from '@/hooks/queries/wardrobe';
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
        <div className="w-8 h-8 border-2 border-black/20 border-t-black rounded-full animate-spin" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useDashboardStats(session?.user?.id);
  const {
    data: clusterData,
    isLoading: clustersLoading,
    error: clustersError,
  } = useClusters(session?.user?.id);

  // Fire-and-forget: score unused items for accurate dashboard stats
  useEffect(() => {
    if (status !== 'authenticated') return;
    const userId = session?.user?.id;
    fetch('/api/clothes/score-unused', { method: 'POST' })
      .catch(() => {})
      .finally(() => {
        queryClient.invalidateQueries(dashboardStatsOptions(userId));
        if (userId) {
          queryClient.invalidateQueries({ queryKey: ['clothes', userId] });
        }
      });
  }, [status, queryClient, session?.user?.id]);

  // Auth guard
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  if (status === 'loading' || statsLoading) {
    return (
      <div className="min-h-screen">
        <div className="px-6 pt-8 pb-4 max-w-6xl mx-auto">
          <div className="h-8 bg-gray-100 rounded w-40 animate-pulse mb-1" />
          <div className="h-4 bg-gray-100 rounded w-60 animate-pulse" />
        </div>
        <div className="px-6 pb-16 max-w-6xl mx-auto space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
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

  if (statsError && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-[#0f172a] mb-2 font-headline">
            Could not load dashboard
          </h2>
          <p className="text-sm text-gray-500 mb-6">{statsError.message}</p>
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

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-bold text-[#0f172a] mb-2 font-headline">
            Loading dashboard…
          </h2>
        </div>
      </div>
    );
  }

  const t = stats.totals;
  const emptyWardrobe = t.items === 0;
  const noPledges = t.pledges_total === 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 pt-8 pb-4 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-[#163422] font-headline">
          Dashboard
        </h1>
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
          <WardrobeValueCard data={stats.wardrobe} totalItems={t.items} />
        )}

        <WearingHabitsChart
          data={stats.wears_over_time}
          thisMonthWears={stats.this_month_wears}
          lastMonthWears={stats.last_month_wears}
          changePct={stats.wear_change_pct}
          insight={stats.wearing_insight}
          totalItems={t.items}
        />

        {!emptyWardrobe && (
          <WornItemsCard
            mostWorn={stats.most_worn}
            leastWorn={stats.least_worn}
          />
        )}

        <ImpactCard
          sustainabilityRate={t.sustainability_rate}
          totalItems={t.items}
          impact={stats.impact}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {!emptyWardrobe && (
            <div className="bg-white rounded-3xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-[#163422] mb-4 font-headline">
                Wardrobe by Category
              </h3>
              <CategoryChart data={stats.categories || []} />
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
              <PledgeTimeline data={stats.pledges_over_time || []} />
            )}
          </div>
        </div>

        {!emptyWardrobe && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-[#163422] mb-4 font-headline">
                Items Added Over Time
              </h3>
              <ItemsAddedChart data={stats.items_over_time || []} />
            </div>
            <div className="bg-white rounded-3xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-[#163422] mb-4 font-headline">
                Top Brands
              </h3>
              <TopBrandsChart data={stats.brands || []} />
            </div>
          </div>
        )}

        {!emptyWardrobe && (
          <WardrobeClustersCard
            data={clusterData ?? null}
            loading={clustersLoading}
            error={!!clustersError}
            onRefresh={() => {
              queryClient.invalidateQueries(clustersOptions(session?.user?.id));
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
