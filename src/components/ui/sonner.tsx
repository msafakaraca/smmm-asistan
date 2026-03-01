"use client"

import { ToastProviderWithGlobal, toast } from "./modern-toast"

// Eski Sonner Toaster'ı yeni modern toast ile değiştir
// Mevcut import'lar çalışmaya devam edecek
const Toaster = () => {
  return null // Provider layout'ta render edilecek
}

export { Toaster, ToastProviderWithGlobal, toast }
