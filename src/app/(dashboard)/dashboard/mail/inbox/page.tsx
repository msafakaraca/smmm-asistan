"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@iconify/react";

// Dynamic import for better code splitting
const InboxModule = dynamic(
  () => import("@/components/mail/inbox/inbox-module"),
  {
    loading: () => <LoadingFallback />,
    ssr: false,
  }
);

function LoadingFallback() {
  return (
    <div className="h-full flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Yükleniyor...</span>
      </div>
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <InboxModule />
    </Suspense>
  );
}
