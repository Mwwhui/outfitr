'use client';

import { useState } from 'react';
import RejectModal from './RejectModal';

export interface PledgeUser {
  id: string;
  email: string;
  name: string;
}

export interface PledgeItem {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
}

export interface Pledge {
  id: string;
  status: 'pending' | 'accepted' | 'rejected';
  action_type: string;
  rejection_reason: string | null;
  qr_token: string | null;
  created_at: string;
  user: PledgeUser | null;
  items: PledgeItem[];
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const ACTION_LABELS: Record<string, string> = {
  donate: 'Donate',
  sell: 'Sell / Trade',
  recycle: 'Recycle',
};

const ACTION_BADGE_COLORS: Record<string, string> = {
  donate: 'bg-amber-100 text-amber-800',
  sell: 'bg-blue-100 text-blue-800',
  recycle: 'bg-green-100 text-green-800',
};

interface Props {
  pledge: Pledge;
  onAccept: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}

export default function PledgeCard({ pledge, onAccept, onReject }: Props) {
  const [showReject, setShowReject] = useState(false);
  const actionLabel = ACTION_LABELS[pledge.action_type] || pledge.action_type;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider ${ACTION_BADGE_COLORS[pledge.action_type] || 'bg-gray-100 text-gray-700'}`}
          >
            {actionLabel}
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider ${STATUS_STYLES[pledge.status]}`}
          >
            {pledge.status}
          </span>
        </div>
        <span className="text-xs text-gray-400">
          {new Date(pledge.created_at).toLocaleDateString()}
        </span>
      </div>

      <div className="mb-3">
        {pledge.user ? (
          <div>
            <p className="font-semibold text-[#0f172a]">{pledge.user.name}</p>
            <p className="text-sm text-gray-500">{pledge.user.email}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Unknown user</p>
        )}
      </div>

      <div className="space-y-1.5 mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Items
        </p>
        {pledge.items.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No items</p>
        ) : (
          pledge.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2"
            >
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-8 h-8 rounded-lg object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-xs text-gray-400">
                  N/A
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0f172a] truncate">
                  {item.name}
                </p>
                {item.brand && (
                  <p className="text-xs text-gray-400 truncate">{item.brand}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {pledge.status === 'pending' && (
        <div className="flex gap-3 pt-3 border-t border-gray-100">
          <button
            onClick={() => onAccept(pledge.id)}
            className="flex-1 py-2.5 bg-[#163422] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition"
          >
            Accept
          </button>
          <button
            onClick={() => setShowReject(true)}
            className="flex-1 py-2.5 bg-red-100 text-red-700 text-sm font-semibold rounded-xl hover:bg-red-200 transition"
          >
            Reject
          </button>
        </div>
      )}

      <RejectModal
        isOpen={showReject}
        onClose={() => setShowReject(false)}
        onConfirm={(reason) => {
          setShowReject(false);
          onReject(pledge.id, reason);
        }}
      />

      {pledge.status === 'rejected' && pledge.rejection_reason && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Rejection Reason
          </p>
          <p className="text-sm text-gray-700">{pledge.rejection_reason}</p>
        </div>
      )}
    </div>
  );
}
