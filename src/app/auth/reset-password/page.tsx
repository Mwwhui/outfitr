"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link. No token provided.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");

      toast.success("Password reset successfully!");
      router.push("/auth/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-red-600 text-2xl">error</span>
          </div>
          <h1 className="text-2xl font-semibold mb-3 text-black font-headline">Invalid link</h1>
          <p className="text-sm text-gray-600 mb-6">
            This reset link is missing or invalid. Please request a new one.
          </p>
          <button
            onClick={() => router.push("/auth/forgot-password")}
            className="text-sm text-blue-600 hover:underline"
          >
            Request a new reset link
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-semibold text-center mb-2 text-black font-headline">
          Reset your password
        </h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          Enter your new password below.
        </p>

        {error && (
          <p className="text-center text-red-500 mb-4 text-sm">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="New password"
            className="w-full border border-black px-4 py-2 rounded-lg text-black placeholder-gray-400"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            minLength={8}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            className="w-full border border-black px-4 py-2 rounded-lg text-black placeholder-gray-400"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
                Resetting...
              </>
            ) : (
              "Reset Password"
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
