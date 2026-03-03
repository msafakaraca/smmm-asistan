"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useBeyannameYonetimi } from "@/components/beyanname-yonetimi/hooks/use-beyanname-yonetimi";
import { BeyannameMatrix } from "@/components/beyanname-yonetimi/beyanname-matrix";
import { BeyannameBulkBar } from "@/components/beyanname-yonetimi/beyanname-bulk-bar";

export function BeyannameYonetimiClient() {
    const {
        customers,
        allCustomersCount,
        allTurleri,
        categoryGroups,
        localAyarlar,
        stats,
        loading,
        saving,
        dirtyCount,
        searchTerm,
        setSearchTerm,
        sirketTipiFilter,
        setSirketTipiFilter,
        selectedCustomerIds,
        toggleCustomer,
        toggleAllCustomers,
        updateCell,
        bulkAssign,
        bulkRemove,
        saveChanges,
    } = useBeyannameYonetimi();

    // Tüm müşterilerin filtredeki seçili olup olmadığı
    const allSelected = useMemo(
        () => customers.length > 0 && selectedCustomerIds.size === customers.length,
        [customers.length, selectedCustomerIds.size]
    );

    if (loading) {
        return (
            <div className="flex flex-col h-[calc(100vh-64px)] -m-4 xl:-m-6 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Veriler yükleniyor...</p>
            </div>
        );
    }

    return (
        <div className="relative flex flex-col h-[calc(100vh-64px)] -m-4 xl:-m-6">
            {/* Toolbar */}
            <div className="shrink-0 border-b bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Link href="/dashboard/mukellefler">
                            <Button variant="ghost" size="sm" className="h-8">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-base font-semibold leading-tight">Beyanname Türü Yönetimi</h1>
                            <p className="text-[11px] text-muted-foreground leading-tight">
                                Her mükellef için verilecek beyanname türlerini ve dönemlerini belirleyin
                                <span className="ml-1">({allCustomersCount} mükellef)</span>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Kısa etiket açıklaması */}
                        <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground border rounded-md px-2.5 h-8">
                            <span><span className="font-semibold text-foreground">A:</span> Aylık</span>
                            <span className="text-border">·</span>
                            <span><span className="font-semibold text-foreground">3A:</span> 3 Aylık</span>
                            <span className="text-border">·</span>
                            <span><span className="font-semibold text-foreground">Y:</span> Yıllık</span>
                            <span className="text-border">·</span>
                            <span><span className="font-semibold text-foreground">6A:</span> 6 Aylık</span>
                            <span className="text-border">·</span>
                            <span><span className="font-semibold text-foreground">15G:</span> 15 Günlük</span>
                            <span className="text-border">·</span>
                            <span><span className="font-semibold text-foreground">D:</span> Dilekçe</span>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Mükellef ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 w-[160px] lg:w-[200px] h-8 text-sm"
                            />
                        </div>
                        <Select value={sirketTipiFilter} onValueChange={setSirketTipiFilter}>
                            <SelectTrigger className="w-[110px] h-8 text-sm">
                                <SelectValue placeholder="Tür" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tümü</SelectItem>
                                <SelectItem value="sahis">Şahıs</SelectItem>
                                <SelectItem value="firma">Firma</SelectItem>
                                <SelectItem value="basit_usul">Basit Usul</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            size="sm"
                            className="h-8"
                            onClick={saveChanges}
                            disabled={dirtyCount === 0 || saving}
                        >
                            {saving ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Save className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            {saving ? "Kaydediliyor..." : "Kaydet"}
                            {dirtyCount > 0 && !saving && (
                                <span className="ml-1.5 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-xs">
                                    {dirtyCount}
                                </span>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Matrix tablo — tüm beyanname türleri tek tabloda */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <BeyannameMatrix
                    customers={customers}
                    allTurleri={allTurleri}
                    categoryGroups={categoryGroups}
                    localAyarlar={localAyarlar}
                    stats={stats}
                    selectedCustomerIds={selectedCustomerIds}
                    allSelected={allSelected}
                    onToggleCustomer={toggleCustomer}
                    onToggleAll={toggleAllCustomers}
                    onUpdateCell={updateCell}
                    onBulkAssign={bulkAssign}
                    onBulkRemove={bulkRemove}
                    hasSelectedCustomers={selectedCustomerIds.size > 0}
                />
            </div>

            {/* Bulk action bar — absolute ile stats bar'ın üzerinde float eder */}
            <BeyannameBulkBar
                selectedCount={selectedCustomerIds.size}
                dirtyCount={dirtyCount}
            />
        </div>
    );
}
