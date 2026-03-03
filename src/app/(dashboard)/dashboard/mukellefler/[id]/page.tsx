import { Metadata } from "next";
import { CustomerDetailClient } from "./client";

export const metadata: Metadata = {
    title: "Mükellef Detayı | SMMM Asistan",
    description: "Mükellef detay bilgileri",
};

export default async function MukellefDetayPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <CustomerDetailClient customerId={id} />;
}
