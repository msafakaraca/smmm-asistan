"use client";

import dynamic from "next/dynamic";

const PosClient = dynamic(
  () => import("@/components/pos/pos-client"),
  { ssr: false }
);

export default function PossorgulamaPage() {
  return <PosClient />;
}
