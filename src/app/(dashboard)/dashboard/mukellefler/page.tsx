import { Metadata } from "next";
import { CustomerListClient } from "./client";

export const metadata: Metadata = {
    title: "Mükellefler | SMMM Asistan",
    description: "Mükellef listesi ve yönetimi",
};

export default function MukelleflerPage() {
    return <CustomerListClient />;
}
