"use client";

import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";

export default function Header() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push("/auth/login");
  };

  return (
    <header className="relative z-10 w-full bg-white shadow-md py-4 px-8 flex justify-between items-center">
      <h1
        className="font-dancingscript font-extrabold text-black text-3xl cursor-pointer "
        onClick={() => router.push("/home")}
      >
        Outfitr
      </h1>

      <nav className="flex gap-6 items-center text-gray-700 font-medium">
        <button
          onClick={() => router.push("/home")}
          className="hover:text-blue-600 transition"
        >
          Home
        </button>

        {session?.user?.role === 'partner' ? (
          <button
            onClick={() => router.push("/partner/dashboard")}
            className="hover:text-blue-600 transition"
          >
            Requests
          </button>
        ) : (
          <>
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
          </>
        )}

        <button
          onClick={() => router.push("/dashboard")}
          className="hover:text-blue-600 transition"
        >
          Dashboard
        </button>

        {/* Profile Section */}
        {session?.user && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 hover:opacity-80 transition"
            >
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt="Profile"
                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-300"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                  {session.user.name?.charAt(0) || "U"}
                </div>
              )}
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-3 border-b border-gray-200">
                  <p className="font-semibold text-gray-800">
                    {session.user.name || "User"}
                  </p>
                  <p className="text-sm text-gray-500">{session.user.email}</p>
                </div>

                <button
                  onClick={() => {
                    router.push("/profile/edit");
                    setIsDropdownOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 transition text-gray-700"
                >
                  Edit Profile
                </button>

                <button
                  onClick={() => {
                    handleLogout();
                    setIsDropdownOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-red-50 transition text-red-600 border-t border-gray-200"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
