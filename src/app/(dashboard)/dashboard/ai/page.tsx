import { Metadata } from "next";
import { AIClient } from "./ai-client";

export const metadata: Metadata = {
    title: "AI Asistan",
    description: "Vergi mevzuatı konusunda AI asistanınıza sorun",
};

export default function AIPage() {
    return <AIClient />;
}
