"use client";

import { Suspense } from "react";
import OutfitSuggestForm from "./OutfitSuggestForm";

export default function OutfitSuggestPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-black/20 border-t-black rounded-full animate-spin" />
      </div>
    }>
      <OutfitSuggestForm />
    </Suspense>
  );
}
