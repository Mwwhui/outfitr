"use client";
import { useRouter } from "next/navigation";
import Header from "../components/Header";

export default function Home() {
  const router = useRouter();

  const handleLogout = () => {
    router.push("/auth/login");
  };

  return (
    <div className="min-h-screen">
      <main className="relative flex min-h-screen flex-col items-center justify-center p-6">

        <div className="max-w-2xl w-full text-center">
          <h1 className="text-5xl font-bold text-black mb-6">
            Welcome to My Website 🚀
          </h1>
          <p className="text-black text-lg mb-8">
            This is your main page (page.tsx). You can start building your UI
            here.
          </p>

          <a
            href="/about"
            className="bg-black text-white px-6 py-3 rounded-lg shadow hover:bg-slate-800 transition duration-200"
          >
            Go to About Page
          </a>
        </div>
      </main>
    </div>
  );
}
