import type { Metadata } from "next";
import { AktivitelerClient } from "./aktiviteler-client";

export const metadata: Metadata = {
  title: "Son Aktiviteler",
};

export default function AktivitelerPage() {
  return <AktivitelerClient />;
}
