"use client";

import dynamic from "next/dynamic";

const BeyannameArsivClient = dynamic(
  () => import("@/components/beyannameler/beyanname-arsiv-client"),
  { ssr: false }
);

export default function BeyannameArsivPage() {
  return <BeyannameArsivClient />;
}
