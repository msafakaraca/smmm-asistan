"use client";

import dynamic from "next/dynamic";

const OkcClient = dynamic(
  () => import("@/components/okc/okc-client"),
  { ssr: false }
);

export default function OkcBildirimPage() {
  return <OkcClient />;
}
