"use client";

export default function Footer() {
  return (
    <footer className="w-full bg-white border-t shadow-sm py-4 px-8 flex justify-between items-center text-gray-600 text-sm mt-auto">
      <p>© {new Date().getFullYear()} Outfitr. All rights reserved.</p>

      <div className="flex gap-4">
        <a href="/about" className="hover:text-blue-600 transition">
          About
        </a>
        <a href="/contact" className="hover:text-blue-600 transition">
          Contact
        </a>
        <a href="/privacy" className="hover:text-blue-600 transition">
          Privacy
        </a>
      </div>
    </footer>
  );
}
