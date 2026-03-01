"use client";

import { KeyRound } from "lucide-react";
import { GibSettingsCard } from "./gib-settings-card";
import { TurmobSettingsCard } from "./turmob-settings-card";
import { EdevletSettingsCard } from "./edevlet-settings-card";

export function PasswordsTab() {
  return (
    <div className="space-y-6">
      {/* Baslik */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="p-2 rounded-lg bg-primary/10">
          <KeyRound className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Sifreler ve Giris Bilgileri</h3>
          <p className="text-sm text-muted-foreground">
            GIB, TURMOB ve e-Devlet sistemlerine erisim icin kullanilan giris bilgileriniz
          </p>
        </div>
      </div>

      {/* GIB Ayarlari */}
      <div className="[&_.card]:border-0 [&_.card]:shadow-none [&_.card]:p-0">
        <GibSettingsCard />
      </div>

      {/* TURMOB Ayarlari */}
      <div className="[&_.card]:border-0 [&_.card]:shadow-none [&_.card]:p-0">
        <TurmobSettingsCard />
      </div>

      {/* e-Devlet Ayarlari */}
      <div className="[&_.card]:border-0 [&_.card]:shadow-none [&_.card]:p-0">
        <EdevletSettingsCard />
      </div>
    </div>
  );
}
