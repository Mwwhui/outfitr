'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Loader from '../../components/Loader';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setErrorMsg('');
    setIsLoading(true);
    try {
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        router.push('/home');
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  // While signing in, hide the form and show only the loader
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader message={'Signing in…'} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-semibold text-center mb-6 text-black font-headline">
          Login
        </h1>

        {errorMsg && (
          <p className="text-center text-red-500 mb-4">{errorMsg}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full border border-black px-4 py-2 rounded-lg text-black placeholder-gray-400"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full border border-black px-4 py-2 rounded-lg text-black placeholder-gray-400"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
          <button
            type="submit"
            className="w-full bg-black text-white py-2 rounded-lg hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            Sign In
          </button>
        </form>

        <div className="mt-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 h-px bg-gray-300" />
            <span className="text-xs text-gray-500">OR</span>
            <div className="flex-1 h-px bg-gray-300" />
          </div>

          <button
            onClick={() => signIn('google', { callbackUrl: '/home' })}
            className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-2 hover:bg-gray-50 transition"
          >
            <Image
              src="https://developers.google.com/identity/images/g-logo.png"
              alt="Google"
              width={20}
              height={20}
            />
            <span className="text-sm font-medium text-gray-700">
              Continue with Google
            </span>
          </button>
        </div>

        {/* Register redirect using router.push */}
        <div className="text-center mt-6">
          <p className="text-gray-600 mb-2">Don&rsquo;t have an account?</p>
          <button
            onClick={() => router.push('/auth/register')}
            className="text-blue-600 hover:underline"
          >
            Register here
          </button>
        </div>

        <div className="text-center mt-4">
          <button
            onClick={() => router.push('/auth/forgot-password')}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Forgot your password?
          </button>
        </div>
      </div>
    </div>
  );
}
