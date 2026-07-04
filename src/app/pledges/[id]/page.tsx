'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Loader from '../../components/Loader';

interface PledgeItem {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
}

interface Partner {
  id: string;
  name: string;
  type: string;
  address: string | null;
  description: string | null;
}

interface Pledge {
  id: string;
  action_type: string;
  status: string;
  label: string;
  progress_pct: number;
  status_text: string;
  partner: Partner | null;
  item_count: number;
  items: PledgeItem[];
  created_at: string;
  fulfilled_at: string | null;
  rejection_reason: string | null;
}

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

const STATUS_MESSAGES: Record<string, string> = {
  pending: 'Awaiting partner acceptance',
  accepted: 'Ready for drop-off — check your email for the QR code',
  fulfilled: 'Completed — items have been delivered',
  rejected: 'This pledge was declined by the partner',
};

const STEPS = ['pending', 'accepted', 'fulfilled'] as const;

function getStepIndex(status: string): number {
  if (status === 'fulfilled') return 2;
  if (status === 'accepted') return 1;
  return 0;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function LargeStepper({ status }: { status: string }) {
  const currentStep = getStepIndex(status);
  return (
    <div className="flex items-center mb-2">
      {STEPS.map((step, i) => {
        const isActive = i <= currentStep && currentStep >= 0;
        const isCurrent = i === currentStep && currentStep >= 0;
        return (
          <div key={step} className="flex-1 flex justify-center items-center relative">
            {i > 0 && (
              <div
                className={`absolute right-1/2 left-0 top-1/2 -translate-y-1/2 h-1 ${
                  i - 1 < currentStep && currentStep >= 0 ? 'bg-primary' : 'bg-surface-variant'
                }`}
              />
            )}
            <div
              className={`w-4 h-4 rounded-full shrink-0 relative z-10 ${
                isCurrent ? 'bg-primary scale-125' : isActive ? 'bg-primary' : 'bg-surface-variant'
              }`}
            />
            {i < STEPS.length - 1 && (
              <div
                className={`absolute left-1/2 right-0 top-1/2 -translate-y-1/2 h-1 ${
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

function LargeStepperLabels({ status }: { status: string }) {
  const currentStep = getStepIndex(status);
  return (
    <div className="flex">
      {STEPS.map((step, i) => (
        <span
          key={step}
          className={`flex-1 text-xs capitalize text-center ${
            i === currentStep && currentStep >= 0 ? 'text-primary font-semibold' : 'text-on-surface-variant'
          }`}
        >
          {step}
        </span>
      ))}
    </div>
  );
}

export default function PledgeDetailPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const pledgeId = params?.id as string;

  const [pledge, setPledge] = useState<Pledge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPledge = useCallback(async () => {
    if (!pledgeId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/pledges/${pledgeId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to load' }));
        throw new Error(err.error || 'Failed to load pledge');
      }
      const data = await res.json();
      setPledge(data.pledge);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [pledgeId]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    if (status === 'authenticated') {
      fetchPledge();
    }
  }, [status, router, fetchPledge]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader message="Loading pledge details..." />
      </div>
    );
  }

  if (error || !pledge) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-[#0f172a] mb-2 font-headline">
            {error || 'Pledge not found'}
          </h2>
          <button
            onClick={() => router.push('/activity')}
            className="bg-black text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition"
          >
            Back to Activity
          </button>
        </div>
      </div>
    );
  }

  const actionLabel = ACTION_LABELS[pledge.action_type] || pledge.action_type;
  const actionColor = ACTION_COLORS[pledge.action_type] || 'bg-gray-100 text-gray-700';
  const statusColor = STATUS_COLORS[pledge.status] || 'bg-gray-50 text-gray-700 border-gray-200';
  const statusMessage = STATUS_MESSAGES[pledge.status] || pledge.status_text;

  return (
    <div className="min-h-screen">
      <div className="px-6 pt-8 pb-4 max-w-2xl mx-auto">
        <button
          onClick={() => router.push('/activity')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition mb-4"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to Activity
        </button>

        <div className="bg-surface-bright rounded-2xl border border-outline-variant shadow-sm p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
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

          {/* Stepper */}
          <div className="mb-6">
            <LargeStepper status={pledge.status} />
            <LargeStepperLabels status={pledge.status} />
          </div>

          {/* Status message */}
          <div
            className={`mb-6 p-4 rounded-xl border ${
              pledge.status === 'rejected'
                ? 'bg-red-50 border-red-200'
                : pledge.status === 'fulfilled'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-blue-50 border-blue-200'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-sm mt-0.5">
                {pledge.status === 'rejected'
                  ? 'error'
                  : pledge.status === 'fulfilled'
                    ? 'check_circle'
                    : 'info'}
              </span>
              <div>
                <p
                  className={`text-sm font-medium ${
                    pledge.status === 'rejected'
                      ? 'text-red-700'
                      : pledge.status === 'fulfilled'
                        ? 'text-green-700'
                        : 'text-blue-700'
                  }`}
                >
                  {statusMessage}
                </p>
                {pledge.status === 'fulfilled' && pledge.fulfilled_at && (
                  <p className="text-xs text-green-600 mt-0.5">
                    Fulfilled on {formatDate(pledge.fulfilled_at)}
                  </p>
                )}
                {pledge.status === 'rejected' && pledge.rejection_reason && (
                  <p className="text-xs text-red-600 mt-0.5">
                    Reason: {pledge.rejection_reason}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Partner card */}
          {pledge.partner && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Partner
              </h3>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-sm font-semibold text-[#0f172a]">{pledge.partner.name}</p>
                {pledge.partner.type && (
                  <p className="text-xs text-gray-500 capitalize mt-0.5">{pledge.partner.type}</p>
                )}
                {pledge.partner.address && (
                  <p className="text-xs text-gray-400 mt-1">{pledge.partner.address}</p>
                )}
                {pledge.partner.description && (
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">{pledge.partner.description}</p>
                )}
              </div>
            </div>
          )}

          {/* Items */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Items ({pledge.item_count})
            </h3>
            {pledge.items.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No items</p>
            ) : (
              <div className="space-y-2">
                {pledge.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100"
                  >
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.name}
                        width={40}
                        height={40}
                        className="rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-xs text-gray-400 shrink-0">
                        <span className="material-symbols-outlined text-sm">checkroom</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0f172a] truncate">{item.name}</p>
                      {item.brand && (
                        <p className="text-xs text-gray-400 truncate">{item.brand}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="pt-4 border-t border-gray-100">
            {pledge.status === 'pending' || pledge.status === 'accepted' ? (
              <Link
                href="/pre-loved"
                className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-[#163422] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition"
              >
                View on Pre-Loved
                <span className="material-symbols-outlined text-xs">open_in_new</span>
              </Link>
            ) : (
              <button
                onClick={() => router.push('/activity')}
                className="w-full py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition"
              >
                Back to Activity
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
