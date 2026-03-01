"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Loader2, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";

const profileSchema = z.object({
  name: z.string().min(2, "Ofis adı en az 2 karakter olmalı"),
  email: z.string().email("Geçerli bir email adresi girin").optional().or(z.literal("")),
  telefon: z.string().optional().or(z.literal("")),
  adres: z.string().optional().or(z.literal("")),
  vergiDairesi: z.string().optional().or(z.literal("")),
  vknTckn: z.string().optional().or(z.literal("")),
  smmmSicilNo: z.string().optional().or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileData {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  telefon: string | null;
  adres: string | null;
  vergiDairesi: string | null;
  vknTckn: string | null;
  smmmSicilNo: string | null;
}

export function InfoSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      email: "",
      telefon: "",
      adres: "",
      vergiDairesi: "",
      vknTckn: "",
      smmmSicilNo: "",
    },
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/settings/profile");
      if (res.ok) {
        const data: ProfileData = await res.json();
        reset({
          name: data.name || "",
          email: data.email || "",
          telefon: data.telefon || "",
          adres: data.adres || "",
          vergiDairesi: data.vergiDairesi || "",
          vknTckn: data.vknTckn || "",
          smmmSicilNo: data.smmmSicilNo || "",
        });
      }
    } catch (error) {
      console.error("Profil yükleme hatası:", error);
      toast.error("Profil bilgileri yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email || null,
          telefon: data.telefon || null,
          adres: data.adres || null,
          vergiDairesi: data.vergiDairesi || null,
          vknTckn: data.vknTckn || null,
          smmmSicilNo: data.smmmSicilNo || null,
        }),
      });

      const result = await res.json();

      if (res.ok) {
        toast.success(result.message || "Profil güncellendi");
        reset(data); // isDirty'yi sıfırla
      } else {
        toast.error(result.error || "Güncelleme başarısız");
      }
    } catch (error) {
      toast.error("Bağlantı hatası");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="p-2 rounded-lg bg-primary/10">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Ofis Bilgileri</h3>
          <p className="text-sm text-muted-foreground">
            Mali müşavirlik ofisinizin genel bilgileri
          </p>
        </div>
      </div>

      {/* Form Alanları */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Ofis Adı */}
        <div className="space-y-2">
          <Label htmlFor="name">
            Ofis Adı <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            placeholder="SMMM Ahmet Yılmaz"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-sm text-red-500">{errors.name.message}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">E-posta</Label>
          <Input
            id="email"
            type="email"
            placeholder="info@ofisiniz.com"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>

        {/* Telefon */}
        <div className="space-y-2">
          <Label htmlFor="telefon">Telefon</Label>
          <Input
            id="telefon"
            placeholder="0212 123 45 67"
            {...register("telefon")}
          />
        </div>

        {/* SMMM Sicil No */}
        <div className="space-y-2">
          <Label htmlFor="smmmSicilNo">SMMM Sicil No</Label>
          <Input
            id="smmmSicilNo"
            placeholder="12345"
            {...register("smmmSicilNo")}
          />
        </div>

        {/* Vergi Kimlik No */}
        <div className="space-y-2">
          <Label htmlFor="vknTckn">Vergi Kimlik No / TC Kimlik No</Label>
          <Input
            id="vknTckn"
            placeholder="1234567890"
            {...register("vknTckn")}
          />
        </div>

        {/* Vergi Dairesi */}
        <div className="space-y-2">
          <Label htmlFor="vergiDairesi">Vergi Dairesi</Label>
          <Input
            id="vergiDairesi"
            placeholder="Kadıköy Vergi Dairesi"
            {...register("vergiDairesi")}
          />
        </div>

        {/* Adres - Tam genişlik */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="adres">Adres</Label>
          <Textarea
            id="adres"
            placeholder="Ofis adresi..."
            rows={3}
            {...register("adres")}
          />
        </div>
      </div>

      {/* Kaydet Butonu */}
      <div className="flex justify-end pt-4 border-t">
        <Button type="submit" disabled={saving || !isDirty} className="gap-2">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Kaydediliyor...
            </>
          ) : isDirty ? (
            <>
              <Save className="h-4 w-4" />
              Değişiklikleri Kaydet
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Kaydedildi
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
