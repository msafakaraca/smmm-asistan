"use client";

import dynamic from "next/dynamic";

const BeyannameSorgulamaPage = dynamic(
  () => import("@/components/beyannameler/beyanname-client"),
  { ssr: false }
);

export default function Page() {
  return <BeyannameSorgulamaPage />;
}
