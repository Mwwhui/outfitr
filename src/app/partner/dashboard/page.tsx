'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
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

  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('pending');

  const fetchPledges = useCallback(async () => {
    try {
      setLoading(true);
      const params = activeTab !== 'all' ? `?status=${activeTab}` : '';
      const res = await fetch(`/api/partner/pledges${params}`);
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to fetch pledges');
        return;
      }
      const data = await res.json();
      setPledges(data as Pledge[]);
    } catch (err) {
      console.error('Error fetching pledges:', err);
      toast.error('Failed to load pledges');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }

    if (status === 'authenticated') {
      if (session.user.role !== 'partner') {
        router.push('/home');
        return;
      }
      fetchPledges();
    }
  }, [status, session, activeTab, fetchPledges, router]);

  const handleAccept = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/partner/pledges/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'accept' }),
        });

        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || 'Failed to accept');
          return;
        }

        toast.success('Pledge accepted! QR code sent to user.');
        fetchPledges();
      } catch (err) {
        console.error('Error accepting pledge:', err);
        toast.error('Something went wrong');
      }
    },
    [fetchPledges],
  );

  const handleFulfill = useCallback(
    async (id: string, token: string) => {
      try {
        const res = await fetch(`/api/partner/pledges/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'fulfill', token }),
        });

        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || 'Failed to fulfill');
          return;
        }

        toast.success('Pledge fulfilled! User notified.');
        fetchPledges();
      } catch (err) {
        console.error('Error fulfilling pledge:', err);
        toast.error('Something went wrong');
      }
    },
    [fetchPledges],
  );

  const handleReject = useCallback(
    async (id: string, reason: string) => {
      try {
        const res = await fetch(`/api/partner/pledges/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reject',
            rejection_reason: reason || undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || 'Failed to reject');
          return;
        }

        toast.success('Pledge rejected. User notified.');
        fetchPledges();
      } catch (err) {
        console.error('Error rejecting pledge:', err);
        toast.error('Something went wrong');
      }
    },
    [fetchPledges],
  );

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#163422] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="px-6 pt-8 pb-4 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-[#163422]">Partner Dashboard</h2>
        <p className="text-[#424843] mt-1">
          Review and manage incoming requests.
        </p>
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

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-8 h-8 border-2 border-[#163422] border-t-transparent rounded-full animate-spin mb-3" />
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
