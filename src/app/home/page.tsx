"use client";
import { useRouter } from "next/navigation";


export default function Home() {
    const router = useRouter();

    const handleLogout = () => {
        router.push("/auth/login");
    };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
      <button 
        onClick={handleLogout}
        className="absolute top-5 right-5 border border-red-500 text-red-500 bg-transparent px-6 py-2 rounded-full hover:bg-red-500 hover:text-white transition"
      >
        Logout
      </button>

      <div className="max-w-2xl w-full text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Welcome to My Website 🚀
        </h1>
        <p className="text-gray-600 text-lg mb-8">
          This is your main page (page.tsx). You can start building your UI here.
        </p>

        <a
          href="/about"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow hover:bg-blue-700 transition duration-200"
        >
          Go to About Page
        </a>
      </div>
    </main>
  );
}
