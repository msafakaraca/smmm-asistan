"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { completeOAuthRegistration } from "@/lib/actions/auth-supabase";

const setPasswordSchema = z
  .object({
    officeName: z.string().min(2, "Ofis adı en az 2 karakter olmalıdır"),
    password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
    confirmPassword: z.string(),
    kvkkConsent: z.literal(true, {
      errorMap: () => ({
        message: "KVKK aydınlatma metnini onaylamanız gereklidir",
      }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Şifreler eşleşmiyor",
    path: ["confirmPassword"],
  });

type SetPasswordFormValues = z.infer<typeof setPasswordSchema>;

export function SetPasswordForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SetPasswordFormValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: {
      officeName: "",
      password: "",
      confirmPassword: "",
      kvkkConsent: false as unknown as true,
    },
  });

  const kvkkConsent = watch("kvkkConsent");

  async function onSubmit(data: SetPasswordFormValues) {
    setIsLoading(true);

    try {
      const result = await completeOAuthRegistration({
        password: data.password,
        officeName: data.officeName,
        kvkkConsent: data.kvkkConsent,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Hesabınız tamamlandı!");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="officeName">Ofis Adı</Label>
        <Input
          id="officeName"
          type="text"
          placeholder="Mali Müşavirlik Ofisi"
          disabled={isLoading}
          {...register("officeName")}
        />
        {errors.officeName && (
          <p className="text-sm text-destructive">
            {errors.officeName.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Şifre</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            disabled={isLoading}
            className="pr-10"
            {...register("password")}
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Şifre Tekrar</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="••••••••"
            disabled={isLoading}
            className="pr-10"
            {...register("confirmPassword")}
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <div className="flex items-start space-x-2">
        <Checkbox
          id="kvkkConsent"
          checked={kvkkConsent}
          onCheckedChange={(checked) =>
            setValue(
              "kvkkConsent",
              checked === true ? true : (false as unknown as true),
              { shouldValidate: true }
            )
          }
          disabled={isLoading}
        />
        <div className="grid gap-1.5 leading-none">
          <label
            htmlFor="kvkkConsent"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            <Link
              href="/kvkk-aydinlatma-metni"
              target="_blank"
              className="text-primary hover:underline"
            >
              KVKK Aydınlatma Metni
            </Link>
            &apos;ni okudum ve onaylıyorum
          </label>
          {errors.kvkkConsent && (
            <p className="text-sm text-destructive">
              {errors.kvkkConsent.message}
            </p>
          )}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Hesabı Tamamla
      </Button>
    </form>
  );
}
