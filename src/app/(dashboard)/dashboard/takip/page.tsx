import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { TakipCizelgesi } from "@/components/takip/takip-cizelgesi";

export const metadata: Metadata = {
    title: "Takip Çizelgesi",
    description: "Aylık muhasebe işlemlerini müşteri bazlı takip edin",
};

export default async function TakipPage() {
    const session = await auth();
    const currentUser = session?.user ? {
        id: session.user.id,
        name: session.user.name,
    } : null;

    return <TakipCizelgesi currentUser={currentUser} />;
}
