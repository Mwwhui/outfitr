"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    dob: "",
    nationality: "",
  });

  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      // Step 1: Register with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });

      if (error) throw new Error(error.message);

      const userId = data.user?.id;

      // Step 2: Store extra info in "users" table
      const { error: insertError } = await supabase.from("users").insert([
        {
          id: userId, // foreign key to Supabase Auth
          username: form.username,
          first_name: form.first_name,
          last_name: form.last_name,
          dob: form.dob,
          nationality: form.nationality,
          email: form.email,
        },
      ]);

      if (insertError) throw new Error(insertError.message);

      alert("Account created! Please verify your email before logging in.");
      router.push("/auth/login");
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-900">
          Create an Account
        </h2>

        {errorMsg && <p className="text-red-500 text-center mb-4">{errorMsg}</p>}

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <input
            type="text"
            name="username"
            className="border rounded-lg px-4 py-2"
            placeholder="Username"
            value={form.username}
            onChange={handleChange}
            required
          />

          <input
            type="text"
            name="first_name"
            className="border rounded-lg px-4 py-2"
            placeholder="First Name"
            value={form.first_name}
            onChange={handleChange}
          />

          <input
            type="text"
            name="last_name"
            className="border rounded-lg px-4 py-2"
            placeholder="Last Name"
            value={form.last_name}
            onChange={handleChange}
          />

          <input
            type="date"
            name="dob"
            className="border rounded-lg px-4 py-2"
            placeholder="Date of Birth"
            value={form.dob}
            onChange={handleChange}
          />

          <input
            type="text"
            name="nationality"
            className="border rounded-lg px-4 py-2"
            placeholder="Nationality"
            value={form.nationality}
            onChange={handleChange}
          />

          <input
            type="email"
            name="email"
            className="border rounded-lg px-4 py-2"
            placeholder="Email Address"
            value={form.email}
            onChange={handleChange}
            required
          />

          <input
            type="password"
            name="password"
            className="border rounded-lg px-4 py-2"
            placeholder="Password (min 6 characters)"
            value={form.password}
            onChange={handleChange}
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
          >
            {loading ? "Signing up..." : "Sign Up"}
          </button>
        </form>

        <p className="text-center mt-4 text-gray-600">
          Already have an account?{" "}
          <a href="/auth/login" className="text-blue-600 hover:underline">
            Login
          </a>
        </p>
      </div>
    </main>
  );
}
