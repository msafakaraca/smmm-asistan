"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";

interface PhoneNumberFormProps {
    defaultPhoneNumber?: string;
}

export function PhoneNumberForm({ defaultPhoneNumber = "" }: PhoneNumberFormProps) {
    const [phoneNumber, setPhoneNumber] = useState(defaultPhoneNumber);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phoneNumber }),
            });

            if (!res.ok) throw new Error("Güncelleme başarısız");
            toast.success("Telefon numarası güncellendi");
        } catch (error) {
            toast.error("Bir hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-2">
                <Label htmlFor="phoneNumber">WhatsApp Telefon Numarası</Label>
                <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    type="tel"
                    placeholder="+90 555 123 45 67"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                    Anımsatıcı bildirimleri bu numaraya gönderilecek
                </p>
            </div>
            <Button type="submit" className="mt-4" disabled={loading}>
                {loading ? "Kaydediliyor..." : "Kaydet"}
            </Button>
        </form>
    );
}
