"use client";

import dynamic from "next/dynamic";

const EarsivFaturaPage = dynamic(
  () => import("@/components/e-arsiv-fatura/e-arsiv-fatura-page"),
  { ssr: false }
);

export default function Page() {
  return <EarsivFaturaPage />;
}
