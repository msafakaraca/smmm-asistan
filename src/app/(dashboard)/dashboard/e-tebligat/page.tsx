"use client";

import dynamic from "next/dynamic";

const EtebligatClient = dynamic(
  () => import("@/components/e-tebligat/etebligat-client"),
  { ssr: false }
);

export default function Page() {
  return <EtebligatClient />;
}
