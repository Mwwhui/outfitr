'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePledges } from '@/hooks/queries/home';
import Loader from '../components/Loader';

interface PledgeItem {
  id: string;
  name: string;
  image_url: string | null;
}

interface Pledge {
  id: string;
  action_type: string;
  status: string;
  label: string;
  progress_pct: number;
  status_text: string;
  partner_name: string | null;
  item_count: number;
  items: PledgeItem[];
  created_at: string;
  fulfilled_at: string | null;
  rejection_reason: string | null;
}

type Tab = 'all' | 'pending' | 'accepted' | 'fulfilled' | 'rejected';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'fulfilled', label: 'Fulfilled' },
  { key: 'rejected', label: 'Rejected' },
];

const ACTION_LABELS: Record<string, string> = {
  donate: 'Donate',
  sell: 'Sell / Trade',
  recycle: 'Recycle',
};

const ACTION_COLORS: Record<string, string> = {
  donate: 'bg-amber-100 text-amber-800',
  sell: 'bg-blue-100 text-blue-800',
  recycle: 'bg-green-100 text-green-800',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  accepted: 'bg-blue-50 text-blue-700 border-blue-200',
  fulfilled: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

const STEPS = ['pending', 'accepted', 'fulfilled'] as const;

function getStepIndex(status: string): number {
  if (status === 'fulfilled') return 2;
  if (status === 'accepted') return 1;
  return 0;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function Stepper({ status }: { status: string }) {
  const currentStep = getStepIndex(status);
  return (
    <div className="flex items-center mb-3">
      {STEPS.map((step, i) => {
        const isActive = i <= currentStep && currentStep >= 0;
        const isCurrent = i === currentStep && currentStep >= 0;
        return (
          <div key={step} className="flex-1 flex justify-center items-center relative">
            {i > 0 && (
              <div
                className={`absolute right-1/2 left-0 top-1/2 -translate-y-1/2 h-0.5 ${
                  i - 1 < currentStep && currentStep >= 0 ? 'bg-primary' : 'bg-surface-variant'
                }`}
              />
            )}
            <div
              className={`w-2.5 h-2.5 rounded-full shrink-0 relative z-10 ${
                isCurrent ? 'bg-primary scale-125' : isActive ? 'bg-primary' : 'bg-surface-variant'
              }`}
            />
            {i < STEPS.length - 1 && (
              <div
                className={`absolute left-1/2 right-0 top-1/2 -translate-y-1/2 h-0.5 ${
                  i < currentStep && currentStep >= 0 ? 'bg-primary' : 'bg-surface-variant'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepperLabels({ status }: { status: string }) {
  const currentStep = getStepIndex(status);
  return (
    <div className="flex mb-4">
      {STEPS.map((step, i) => (
        <span
          key={step}
          className={`flex-1 text-[10px] capitalize text-center ${
            i === currentStep && currentStep >= 0 ? 'text-primary font-semibold' : 'text-on-surface-variant'
          }`}
        >
          {step}
        </span>
      ))}
    </div>
  );
}

function PledgeCard({ pledge }: { pledge: Pledge }) {
  const router = useRouter();
  const actionLabel = ACTION_LABELS[pledge.action_type] || pledge.action_type;
  const actionColor = ACTION_COLORS[pledge.action_type] || 'bg-gray-100 text-gray-700';
  const statusColor = STATUS_COLORS[pledge.status] || 'bg-gray-50 text-gray-700 border-gray-200';

  return (
    <div
      onClick={() => router.push(`/pledges/${pledge.id}`)}
      className="bg-surface-bright rounded-2xl border border-outline-variant shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-gray-300 transition"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider ${actionColor}`}>
            {actionLabel}
          </span>
          <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider border ${statusColor}`}>
            {pledge.status}
          </span>
        </div>
        <span className="text-xs text-on-surface-variant shrink-0">{formatDate(pledge.created_at)}</span>
      </div>

      <div className="mb-1">
        <p className="text-sm font-semibold text-[#0f172a]">{pledge.partner_name || 'Unknown Partner'}</p>
        <p className="text-xs text-on-surface-variant mt-0.5">{pledge.status_text}</p>
      </div>

      <Stepper status={pledge.status} />
      <StepperLabels status={pledge.status} />

      {pledge.items.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex -space-x-1.5">
            {pledge.items.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="w-8 h-8 rounded-full bg-surface-variant border-2 border-white overflow-hidden shrink-0"
              >
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-xs text-on-surface-variant flex items-center justify-center h-full">
                    checkroom
                  </span>
                )}
              </div>
            ))}
          </div>
          <span className="text-xs text-on-surface-variant truncate">
            {pledge.items.slice(0, 2).map((i) => i.name).join(', ')}
            {pledge.items.length > 2 && ` +${pledge.items.length - 2}`}
          </span>
        </div>
      )}

      {pledge.status === 'rejected' && pledge.rejection_reason && (
        <div className="mt-2 p-2.5 bg-red-50 rounded-xl border border-red-100">
          <p className="text-xs text-red-700">
            <span className="font-semibold">Reason:</span> {pledge.rejection_reason}
          </p>
        </div>
      )}
    </div>
  );
}

export default function ActivityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('all');

  const { data: pledgesData, isLoading, isError, error: queryError, refetch } = usePledges(session?.user?.id);
  const pledges: Pledge[] = pledgesData?.pledges || [];

  if (status === 'unauthenticated') {
    router.push('/auth/login');
    return null;
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader message="Loading session..." />
      </div>
    );
  }

  const filtered =
    activeTab === 'all' ? pledges : pledges.filter((p) => p.status === activeTab);

  const counts = {
    all: pledges.length,
    pending: pledges.filter((p) => p.status === 'pending').length,
    accepted: pledges.filter((p) => p.status === 'accepted').length,
    fulfilled: pledges.filter((p) => p.status === 'fulfilled').length,
    rejected: pledges.filter((p) => p.status === 'rejected').length,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader message="Loading pledges..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="px-6 pt-8 pb-4 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-[#163422] font-headline">Activity</h1>
        <p className="text-[#424843] mt-1">Track your pre-loved pledges and donations</p>
      </div>

      <div className="px-6 pb-16 max-w-5xl mx-auto space-y-6">
        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
            {queryError?.message || 'Failed to load pledges'}
            <button
              onClick={() => refetch()}
              className="ml-2 underline font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        <div className="flex gap-2 border-b border-gray-200 pb-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-[1px] shrink-0 ${
                activeTab === tab.key
                  ? 'text-[#163422] border-[#163422]'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span
                className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? 'bg-[#163422] text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {counts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-5xl mb-3">📋</div>
            <p className="text-lg font-medium text-gray-500">
              {activeTab === 'all' ? 'No pledges yet' : `No ${activeTab} pledges`}
            </p>
            <p className="text-sm mt-1">
              {activeTab === 'all'
                ? 'Start your sustainable journey by pledging items on Pre-Loved.'
                : 'Check another tab or create a new pledge.'}
            </p>
            {activeTab === 'all' && (
              <Link
                href="/pre-loved"
                className="inline-block mt-4 bg-black text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition"
              >
                Go to Pre-Loved
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((pledge) => (
              <PledgeCard key={pledge.id} pledge={pledge} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
