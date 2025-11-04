"use client";

import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();

  return (
    <header className="w-full bg-white shadow-sm py-4 px-8 flex justify-between items-center">
      <h1
        className="text-2xl font-bold text-gray-800 cursor-pointer"
        onClick={() => router.push("/home")}
      >
        Outfitr
      </h1>

      <nav className="flex gap-6 text-gray-700 font-medium">
        <button
          onClick={() => router.push("/home")}
          className="hover:text-blue-600 transition"
        >
          Home
        </button>

        <button
          onClick={() => router.push("/wardrobe")}
          className="hover:text-blue-600 transition"
        >
          Wardrobe
        </button>

        <button
          onClick={() => router.push("/pre-loved")}
          className="hover:text-blue-600 transition"
        >
          Pre-loved
        </button>

        <button
          onClick={() => router.push("/dashboard")}
          className="hover:text-blue-600 transition"
        >
          Dashboard
        </button>
      </nav>
    </header>
  );
}
