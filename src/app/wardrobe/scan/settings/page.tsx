'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function ExtensionSettingsPage() {
  const router = useRouter();
  const { status } = useSession();
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    if (status === 'authenticated') {
      fetch('/api/auth/extension-token')
        .then((res) => res.json())
        .then((data) => {
          if (data.token) {
            setToken(data.token);
            setExpiresAt(data.expires_at);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [status, router]);

  const generateToken = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/extension-token', { method: 'POST' });
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        setExpiresAt(data.expires_at);
        setCopied(false);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const copyToken = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
    } catch {
      const el = document.createElement('textarea');
      el.value = token;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-8 max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-surface-container transition">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold font-headline text-on-surface flex-1">
            Browser Extension
          </h1>
        </div>

        <p className="text-sm text-on-surface-variant leading-relaxed">
          Connect the Outfitr browser extension to scan products from any shopping
          website. Copy the token below and paste it into the extension.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : token ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
                Your API Token
              </label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={token}
                  className="flex-1 bg-surface-variant border border-outline-variant rounded-xl px-3 py-2 text-xs font-mono text-on-surface select-all"
                />
                <button
                  onClick={copyToken}
                  className="bg-primary text-on-primary px-4 py-2 rounded-xl text-xs font-semibold shrink-0 hover:opacity-90 transition"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {expiresAt && (
              <p className="text-xs text-on-surface-variant">
                Expires: {formatDate(expiresAt)}
              </p>
            )}

            <button
              onClick={generateToken}
              className="text-sm font-semibold text-primary underline"
            >
              Generate new token (old one will stop working)
            </button>
          </div>
        ) : (
          <div className="text-center py-8 space-y-4">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant">
              extension
            </span>
            <p className="text-sm text-on-surface-variant">
              No token yet. Generate one to connect the browser extension.
            </p>
            <button
              onClick={generateToken}
              className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-semibold hover:opacity-90 transition text-sm"
            >
              Generate Token
            </button>
          </div>
        )}

        <div className="bg-surface-variant rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            How it works
          </p>
          <ol className="text-xs text-on-surface-variant space-y-1.5 list-decimal list-inside">
            <li>Install the Outfitr Scan browser extension from the Chrome Web Store</li>
            <li>Generate a token above and copy it</li>
            <li>Right-click any product image on a shopping site</li>
            <li>Select &quot;Scan with Outfitr&quot; to see the analysis</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
