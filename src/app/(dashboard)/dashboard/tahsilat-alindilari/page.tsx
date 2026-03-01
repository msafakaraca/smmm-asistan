"use client";

import dynamic from "next/dynamic";

const TahsilatAlindilariPage = dynamic(
  () => import("@/components/tahsilat/tahsilat-client"),
  { ssr: false }
);

export default function Page() {
  return <TahsilatAlindilariPage />;
}
