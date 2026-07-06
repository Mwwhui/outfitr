'use client';

import { useEffect, useState, useRef } from 'react';

type Status = 'loading' | 'signin_required' | 'connected' | 'error';

export default function ExtensionConnectPage() {
  const [status, setStatus] = useState<Status>('loading');
  const [token, setToken] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchToken = async (): Promise<'ok' | 'unauthorized' | 'error'> => {
    try {
      const res = await fetch('/api/auth/extension-token', { method: 'POST', credentials: 'include' });
      if (res.status === 401) return 'unauthorized';
      if (!res.ok) return 'error';
      const data = await res.json();
      if (data?.token) {
        setToken(data.token);
        return 'ok';
      }
      return 'unauthorized';
    } catch {
      return 'error';
    }
  };

  useEffect(() => {
    fetchToken().then((result) => {
      if (result === 'ok') setStatus('connected');
      else if (result === 'error') setStatus('error');
      else setStatus('signin_required');
    });

    // Start polling — detects session appearing after login in another tab
    pollRef.current = setInterval(async () => {
      const result = await fetchToken();
      if (result === 'ok') {
        setStatus('connected');
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } else if (result === 'error') {
        setStatus('error');
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (status === 'connected' && token) {
      const timer = setTimeout(() => window.close(), 800);
      return () => clearTimeout(timer);
    }
  }, [status, token]);

  const handleSignIn = () => {
    window.open('/auth/login', '_blank');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center max-w-sm p-8">
        {status === 'loading' && (
          <>
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-on-surface-variant">
              Connecting to Outfitr...
            </p>
          </>
        )}

        {status === 'signin_required' && (
          <>
            <div className="text-4xl mb-4">🔗</div>
            <h1 className="text-xl font-headline font-bold mb-2 text-on-surface">
              Sign in to connect
            </h1>
            <p className="text-sm text-on-surface-variant mb-2">
              Log in to your Outfitr account to link this extension.
            </p>
            <p className="text-xs text-on-surface-variant mb-6">
              This tab will auto-detect when you&rsquo;re logged in and connect automatically.
            </p>
            <button
              onClick={handleSignIn}
              className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition"
            >
              Sign In
            </button>
          </>
        )}

        {status === 'connected' && (
          <div
            id="extension-connect-token"
            data-token={token}
          >
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-green-600 text-2xl">✓</span>
            </div>
            <p className="text-sm font-semibold text-on-surface">
              Connected!
            </p>
            <p className="text-xs text-on-surface-variant mt-1">
              You can close this tab.
            </p>
          </div>
        )}

        {status === 'error' && (
          <>
            <div className="text-4xl mb-4">⚠</div>
            <h1 className="text-xl font-headline font-bold mb-2 text-on-surface">
              Connection failed
            </h1>
            <p className="text-sm text-on-surface-variant mb-6">
              Could not connect your extension. Please try again.
            </p>
            <button
              onClick={() => {
                setStatus('loading');
                fetchToken().then((ok) => {
                  if (!ok) setStatus('signin_required');
                });
              }}
              className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
