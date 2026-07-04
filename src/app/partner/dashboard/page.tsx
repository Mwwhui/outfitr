'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { usePartnerPledges } from '@/hooks/queries/partners';
import { useUpdatePledgeStatus } from '@/hooks/mutations/pledges';
import PledgeCard, { Pledge } from '../../components/partner/PledgeCard';

type Tab = 'all' | 'pending' | 'accepted' | 'rejected' | 'fulfilled';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'fulfilled', label: 'Fulfilled' },
  { key: 'rejected', label: 'Rejected' },
];

export default function PartnerDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('pending');

  const { data: pledges = [], isLoading, refetch } = usePartnerPledges(session?.user?.id, activeTab !== 'all' ? activeTab : undefined);
  const updatePledge = useUpdatePledgeStatus(session?.user?.id, activeTab !== 'all' ? activeTab : undefined);

  if (status === 'unauthenticated') {
    router.push('/auth/login');
    return null;
  }

  if (status === 'authenticated' && session.user.role !== 'partner') {
    router.push('/home');
    return null;
  }

  const handleAccept = useCallback(
    async (id: string) => {
      try {
        await updatePledge.mutateAsync({ id, action: 'accept' });
        toast.success('Pledge accepted! QR code sent to user.');
      } catch (err) {
        console.error('Error accepting pledge:', err);
        toast.error(err instanceof Error ? err.message : 'Something went wrong');
      }
    },
    [updatePledge],
  );

  const handleFulfill = useCallback(
    async (id: string, token: string) => {
      try {
        await updatePledge.mutateAsync({ id, action: 'fulfill', token });
        toast.success('Pledge fulfilled! User notified.');
      } catch (err) {
        console.error('Error fulfilling pledge:', err);
        toast.error(err instanceof Error ? err.message : 'Something went wrong');
      }
    },
    [updatePledge],
  );

  const handleReject = useCallback(
    async (id: string, reason: string) => {
      try {
        await updatePledge.mutateAsync({ id, action: 'reject', rejection_reason: reason || undefined });
        toast.success('Pledge rejected. User notified.');
      } catch (err) {
        console.error('Error rejecting pledge:', err);
        toast.error(err instanceof Error ? err.message : 'Something went wrong');
      }
    },
    [updatePledge],
  );

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black/20 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="px-6 pt-8 pb-4 max-w-4xl mx-auto flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[#163422]">Partner Dashboard</h2>
          <p className="text-[#424843] mt-1">
            Review and manage incoming requests.
          </p>
        </div>
        <button
          onClick={() => router.push('/partner/scan')}
          className="bg-[#163422] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition flex items-center gap-2 shrink-0 mt-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9V7a2 2 0 012-2h2M3 15v2a2 2 0 002 2h2M21 9V7a2 2 0 00-2-2h-2M21 15v2a2 2 0 01-2 2h-2M9 3h6M9 21h6M9 9h6v6H9z" />
          </svg>
          Scan QR
        </button>
      </div>

      <div className="px-6 pb-16 max-w-4xl mx-auto space-y-6">
        <div className="flex gap-2 border-b border-gray-200 pb-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-[1px] ${
                activeTab === tab.key
                  ? 'text-[#163422] border-[#163422]'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-8 h-8 border-2 border-black/20 border-t-black rounded-full animate-spin mb-3" />
            <p className="text-sm">Loading pledges...</p>
          </div>
        ) : pledges.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-5xl mb-3">📋</div>
            <p className="text-lg font-medium text-gray-500">No requests found</p>
            <p className="text-sm mt-1">
              {activeTab === 'pending'
                ? 'No pending requests. Check back later.'
                : `No ${activeTab} requests yet.`}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pledges.map((pledge) => (
              <PledgeCard
                key={pledge.id}
                pledge={pledge}
                onAccept={handleAccept}
                onReject={handleReject}
                onFulfill={handleFulfill}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
