"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-green-600 text-2xl">check</span>
          </div>
          <h1 className="text-2xl font-semibold mb-3 text-black font-headline">Check your email</h1>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            If an account with <strong>{email}</strong> exists, we&apos;ve sent a password reset
            link. It expires in 1 hour.
          </p>
          <button
            onClick={() => router.push("/auth/login")}
            className="text-sm text-blue-600 hover:underline"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-semibold text-center mb-2 text-black font-headline">
          Forgot password?
        </h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        {error && (
          <p className="text-center text-red-500 mb-4 text-sm">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full border border-black px-4 py-2 rounded-lg text-black placeholder-gray-400"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-2 rounded-lg hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Sending...
              </>
            ) : (
              "Send Reset Link"
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => router.push("/auth/login")}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
