"use client";

import { useState } from "react";
import { SidebarMenu } from "./sidebar-menu";
import { GibPasswordsTable } from "./gib-passwords-table";
import { SgkPasswordsTable } from "./sgk-passwords-table";
import { TurmobPasswordsTable } from "./turmob-passwords-table";
import { IskurPasswordsTable } from "./iskur-passwords-table";
import { EdevletPasswordsTable } from "./edevlet-passwords-table";

export function SifrelerModule() {
  const [activeTab, setActiveTab] = useState<"gib" | "sgk" | "iskur" | "turmob" | "edevlet">("gib");

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sol Sidebar - 280px */}
      <aside className="w-72 border-r bg-muted/30 flex flex-col shrink-0">
        <div className="p-6 border-b">
          <h3 className="font-semibold text-lg">Şifre Yönetimi</h3>
          <p className="text-sm text-muted-foreground">Portal giriş bilgileri</p>
        </div>
        <SidebarMenu activeTab={activeTab} onTabChange={setActiveTab} />
      </aside>

      {/* Sağ İçerik */}
      <main className="flex-1 overflow-hidden">
        {activeTab === "gib" && <GibPasswordsTable />}
        {activeTab === "sgk" && <SgkPasswordsTable />}
        {activeTab === "iskur" && <IskurPasswordsTable />}
        {activeTab === "turmob" && <TurmobPasswordsTable />}
        {activeTab === "edevlet" && <EdevletPasswordsTable />}
      </main>
    </div>
  );
}
