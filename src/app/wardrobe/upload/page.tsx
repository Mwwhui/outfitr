"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function UploadClothes() {
  const router = useRouter();
  const { data: session } = useSession();

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    setErrorMsg("");

    if (!session?.user?.id) {
      setErrorMsg("You must be logged in.");
      return;
    }

    if (!imageFile) {
      setErrorMsg("Please select an image.");
      return;
    }

    try {
      // 1. Upload image to Supabase Storage
      const formData = new FormData();
      formData.append("file", imageFile);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        throw new Error(uploadData.error || "Upload failed");
      }

      const imageUrl = uploadData.url;

      // 2. Save clothes data to DB
      const saveRes = await fetch("/api/clothes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: session.user.id,
          name,
          type,
          image_url: imageUrl,
        }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error || "Failed to save clothes");
      }

      router.push("/wardrobe");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Upload Clothing</h1>

      {errorMsg && <p className="text-red-500 mb-3">{errorMsg}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Name (ex: White T-Shirt)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />

        <input
          type="text"
          placeholder="Type (ex: Shirt, Pants, Jacket)"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files?.[0] || null)}
          className="w-full border p-2 rounded"
          required
        />

        <button
          type="submit"
          disabled={isUploading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isUploading ? "Uploading..." : "Upload"}
        </button>
      </form>
    </div>
  );
}
