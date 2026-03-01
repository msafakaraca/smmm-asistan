"use client";

import dynamic from "next/dynamic";

const EdefterKontrolPage = dynamic(
  () => import("@/components/e-defter/e-defter-kontrol-page"),
  { ssr: false }
);

export default function Page() {
  return <EdefterKontrolPage />;
}
