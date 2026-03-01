"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction } from "@/lib/actions/auth-supabase";

const forgotPasswordSchema = z.object({
  email: z.string().email("Geçerli bir email adresi girin"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(data: ForgotPasswordFormValues) {
    setIsLoading(true);

    try {
      const result = await resetPasswordAction(data.email);
      if (result.error) {
        toast.error(result.error);
      } else {
        setIsSent(true);
        toast.success("Şifre sıfırlama bağlantısı gönderildi");
      }
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setIsLoading(false);
    }
  }

  if (isSent) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 p-4 dark:bg-green-900/30">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Eğer bu email adresiyle bir hesap varsa, şifre sıfırlama bağlantısı
          gönderilmiştir. Lütfen gelen kutunuzu kontrol edin.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-posta</Label>
        <Input
          id="email"
          type="email"
          placeholder="ornek@email.com"
          disabled={isLoading}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Sıfırlama Bağlantısı Gönder
      </Button>
    </form>
  );
}
