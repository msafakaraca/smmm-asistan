"use client";

import { memo, useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Loader2, AlertCircle } from "lucide-react";
import { PendingDebtsSelector } from "./pending-debts-selector";
import { CheckForm } from "./check-form";
import type {
  PendingDebtWithBalance,
  CollectRequest,
  PaymentMethod,
  Currency,
  CheckFormValues,
} from "../shared/finance-types";
import { PAYMENT_METHOD_LABELS, CURRENCY_LABELS, PaymentMethodEnum, CurrencyEnum } from "../shared/finance-types";

interface CustomerOption {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
}

interface CollectionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: CustomerOption[];
  preSelectedCustomerId?: string;
  fetchPendingDebts: (customerId: string) => Promise<PendingDebtWithBalance[]>;
  onCollect: (data: CollectRequest) => Promise<void>;
}

export const CollectionForm = memo(function CollectionForm({
  open,
  onOpenChange,
  customers,
  preSelectedCustomerId,
  fetchPendingDebts,
  onCollect,
}: CollectionFormProps) {
  // Form state
  const [customerId, setCustomerId] = useState(preSelectedCustomerId || "");
  const [pendingDebts, setPendingDebts] = useState<PendingDebtWithBalance[]>([]);
  const [debtsLoading, setDebtsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedTotal, setSelectedTotal] = useState(0);
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [checkData, setCheckData] = useState<CheckFormValues>({
    checkNumber: "",
    bankName: "",
    dueDate: "",
    amount: 0,
  });
  const [saving, setSaving] = useState(false);

  // Müşteri seçildiğinde borçları yükle
  const loadPendingDebts = useCallback(async (cId: string) => {
    if (!cId) {
      setPendingDebts([]);
      setSelectedIds([]);
      setSelectedTotal(0);
      return;
    }
    try {
      setDebtsLoading(true);
      const data = await fetchPendingDebts(cId);
      setPendingDebts(data);
      setSelectedIds([]);
      setSelectedTotal(0);
    } catch (error) {
      toast.error("Bekleyen borçlar yüklenemedi");
      setPendingDebts([]);
    } finally {
      setDebtsLoading(false);
    }
  }, [fetchPendingDebts]);

  // Pre-selected customer
  useEffect(() => {
    if (open && preSelectedCustomerId) {
      setCustomerId(preSelectedCustomerId);
      loadPendingDebts(preSelectedCustomerId);
    }
  }, [open, preSelectedCustomerId, loadPendingDebts]);

  // Müşteri değişimi
  const handleCustomerChange = useCallback((value: string) => {
    setCustomerId(value);
    loadPendingDebts(value);
  }, [loadPendingDebts]);

  // Borç seçimi değişimi
  const handleSelectionChange = useCallback((ids: string[], total: number) => {
    setSelectedIds(ids);
    setSelectedTotal(total);
    setAmount(total);
    // Çek tutarını da güncelle
    setCheckData((prev) => ({ ...prev, amount: total }));
  }, []);

  // Form sıfırla
  const resetForm = useCallback(() => {
    setCustomerId(preSelectedCustomerId || "");
    setPendingDebts([]);
    setSelectedIds([]);
    setSelectedTotal(0);
    setAmount(0);
    setPaymentMethod("CASH");
    setCurrency("TRY");
    setExchangeRate(1);
    setDate(new Date().toISOString().split("T")[0]);
    setNote("");
    setCheckData({ checkNumber: "", bankName: "", dueDate: "", amount: 0 });
  }, [preSelectedCustomerId]);

  // Kaydet
  const handleSubmit = useCallback(async () => {
    // Validasyonlar
    if (!customerId) {
      toast.error("Müşteri seçiniz");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("En az bir borç seçiniz");
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("Geçerli bir tutar giriniz");
      return;
    }
    if (!date) {
      toast.error("Tarih seçiniz");
      return;
    }
    if (paymentMethod === "CHECK" && !checkData.dueDate) {
      toast.error("Çek vade tarihi zorunludur");
      return;
    }

    try {
      setSaving(true);
      const request: CollectRequest = {
        customerId,
        transactionIds: selectedIds,
        amount,
        paymentMethod,
        currency,
        date,
        note: note || undefined,
      };

      if (currency !== "TRY") {
        request.exchangeRate = exchangeRate;
      }

      if (paymentMethod === "CHECK") {
        request.checkData = {
          checkNumber: checkData.checkNumber || undefined,
          bankName: checkData.bankName || undefined,
          dueDate: checkData.dueDate,
          amount: checkData.amount || amount,
        };
      }

      await onCollect(request);
      toast.success("Tahsilat başarıyla kaydedildi");
      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tahsilat kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }, [customerId, selectedIds, amount, paymentMethod, currency, exchangeRate, date, note, checkData, onCollect, resetForm, onOpenChange]);

  const isPartialPayment = amount > 0 && amount < selectedTotal;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tahsilat Kaydı</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Müşteri Seçimi */}
          <div className="space-y-1.5">
            <Label>
              Müşteri <span className="text-destructive">*</span>
            </Label>
            <Select value={customerId} onValueChange={handleCustomerChange}>
              <SelectTrigger>
                <SelectValue placeholder="Müşteri seçiniz" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.kisaltma || c.unvan}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Borç Seçimi */}
          {customerId && (
            <div className="space-y-1.5">
              <Label>Bekleyen Borçlar</Label>
              <PendingDebtsSelector
                debts={pendingDebts}
                loading={debtsLoading}
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
              />
            </div>
          )}

          {/* Ödeme Bilgileri */}
          {selectedIds.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tutar */}
                <div className="space-y-1.5">
                  <Label htmlFor="amount">
                    Tahsil Edilen Tutar <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount || ""}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  />
                  {isPartialPayment && (
                    <div className="flex items-center gap-1.5 text-xs text-orange-600">
                      <AlertCircle className="h-3 w-3" />
                      Kısmi tahsilat - kalan tutar borç olarak kalacaktır
                    </div>
                  )}
                </div>

                {/* Ödeme Yöntemi */}
                <div className="space-y-1.5">
                  <Label>
                    Ödeme Yöntemi <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PaymentMethodEnum.map((pm) => (
                        <SelectItem key={pm} value={pm}>
                          {PAYMENT_METHOD_LABELS[pm]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Para Birimi */}
                <div className="space-y-1.5">
                  <Label>Para Birimi</Label>
                  <Select
                    value={currency}
                    onValueChange={(v) => setCurrency(v as Currency)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CurrencyEnum.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CURRENCY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Kur (TRY dışında) */}
                {currency !== "TRY" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="exchangeRate">Kur</Label>
                    <Input
                      id="exchangeRate"
                      type="number"
                      min="0"
                      step="0.0001"
                      value={exchangeRate || ""}
                      onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                )}

                {/* Tarih */}
                <div className="space-y-1.5">
                  <Label htmlFor="collectionDate">
                    Tarih <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="collectionDate"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Çek Formu */}
              {paymentMethod === "CHECK" && (
                <CheckForm
                  value={checkData}
                  onChange={setCheckData}
                />
              )}

              {/* Not */}
              <div className="space-y-1.5">
                <Label htmlFor="collectionNote">Not</Label>
                <Textarea
                  id="collectionNote"
                  placeholder="Opsiyonel açıklama..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            İptal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || selectedIds.length === 0 || !amount}
          >
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Tahsil Et
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
