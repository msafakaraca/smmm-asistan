"use client";

import dynamic from "next/dynamic";

const SgkClient = dynamic(
  () => import("@/components/sgk-sorgulama/sgk-client"),
  { ssr: false }
);

export default function SgkSorgulamaPage() {
  return <SgkClient />;
}
