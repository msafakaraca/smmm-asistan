"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Eye, EyeOff, Check, X } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { OAuthButton } from "@/components/auth/oauth-button";
import { LegalDialog } from "@/components/auth/legal-dialog";
import { registerAction } from "@/lib/actions/auth-supabase";

const registerSchema = z.object({
  officeName: z.string().min(2, "Ofis adı en az 2 karakter olmalıdır"),
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır"),
  email: z.string().email("Geçerli bir email adresi girin"),
  password: z
    .string()
    .min(12, "Şifre en az 12 karakter olmalıdır")
    .regex(/[A-Z]/, "En az bir büyük harf içermelidir")
    .regex(/[a-z]/, "En az bir küçük harf içermelidir")
    .regex(/[0-9]/, "En az bir rakam içermelidir"),
  confirmPassword: z.string(),
  kvkkConsent: z.literal(true, {
    errorMap: () => ({ message: "KVKK aydınlatma metnini onaylamanız gereklidir" }),
  }),
  termsConsent: z.literal(true, {
    errorMap: () => ({ message: "Kullanım koşullarını kabul etmeniz gereklidir" }),
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Şifreler eşleşmiyor",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {met ? (
        <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
      ) : (
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span
        className={`text-xs ${
          met ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
        }`}
      >
        {text}
      </span>
    </div>
  );
}

export function RegisterForm() {
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
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      officeName: "",
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      kvkkConsent: false as unknown as true,
      termsConsent: false as unknown as true,
    },
  });

  const kvkkConsent = watch("kvkkConsent");
  const termsConsent = watch("termsConsent");
  const passwordValue = watch("password");
  const confirmPasswordValue = watch("confirmPassword");

  // Şifre gereksinimleri kontrolü
  const passwordChecks = {
    minLength: passwordValue?.length >= 12,
    hasUppercase: /[A-Z]/.test(passwordValue || ""),
    hasLowercase: /[a-z]/.test(passwordValue || ""),
    hasNumber: /[0-9]/.test(passwordValue || ""),
  };
  const passwordsMatch = passwordValue && confirmPasswordValue && passwordValue === confirmPasswordValue;
  const passwordsMismatch = confirmPasswordValue && passwordValue !== confirmPasswordValue;

  async function onSubmit(data: RegisterFormValues) {
    setIsLoading(true);

    try {
      const result = await registerAction({
        email: data.email,
        password: data.password,
        name: data.name,
        officeName: data.officeName,
        kvkkConsent: data.kvkkConsent,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Hesabınız oluşturuldu! Lütfen email adresinizi doğrulayın.");
      router.push("/auth/verify-email");
    } catch {
      toast.error("Kayıt sırasında bir hata oluştu");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
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
          <Label htmlFor="name">Ad Soyad</Label>
          <Input
            id="name"
            type="text"
            placeholder="Adınız Soyadınız"
            disabled={isLoading}
            {...register("name")}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

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

        <div className="space-y-2">
          <Label htmlFor="password">Şifre</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder=""
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
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-destructive">
              {errors.password.message}
            </p>
          )}
          {/* Şifre gereksinimleri */}
          {passwordValue && (
            <div className="space-y-1 pt-1">
              <PasswordRequirement met={passwordChecks.minLength} text="En az 12 karakter" />
              <PasswordRequirement met={passwordChecks.hasUppercase} text="En az bir büyük harf (A-Z)" />
              <PasswordRequirement met={passwordChecks.hasLowercase} text="En az bir küçük harf (a-z)" />
              <PasswordRequirement met={passwordChecks.hasNumber} text="En az bir rakam (0-9)" />
            </div>
          )}
          {!passwordValue && (
            <p className="text-xs text-muted-foreground">
              En az 12 karakter, büyük harf, küçük harf ve rakam içermelidir.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Şifre Tekrarı</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder=""
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
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">
              {errors.confirmPassword.message}
            </p>
          )}
          {passwordsMatch && (
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
              <Check className="h-3.5 w-3.5" />
              Şifreler eşleşiyor
            </p>
          )}
          {passwordsMismatch && !errors.confirmPassword && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <X className="h-3.5 w-3.5" />
              Şifreler eşleşmiyor
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="kvkkConsent"
              checked={kvkkConsent}
              onCheckedChange={(checked) =>
                setValue("kvkkConsent", checked === true ? true : (false as unknown as true), {
                  shouldValidate: true,
                })
              }
              disabled={isLoading}
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="kvkkConsent"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                <LegalDialog type="kvkk">
                  <button type="button" className="text-primary hover:underline">
                    KVKK Aydınlatma Metni
                  </button>
                </LegalDialog>
                &apos;ni okudum ve onaylıyorum
              </label>
              {errors.kvkkConsent && (
                <p className="text-sm text-destructive">
                  {errors.kvkkConsent.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="termsConsent"
              checked={termsConsent}
              onCheckedChange={(checked) =>
                setValue("termsConsent", checked === true ? true : (false as unknown as true), {
                  shouldValidate: true,
                })
              }
              disabled={isLoading}
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="termsConsent"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                <LegalDialog type="kullanim-kosullari">
                  <button type="button" className="text-primary hover:underline">
                    Kullanım Koşulları
                  </button>
                </LegalDialog>
                &apos;nı okudum ve kabul ediyorum
              </label>
              {errors.termsConsent && (
                <p className="text-sm text-destructive">
                  {errors.termsConsent.message}
                </p>
              )}
            </div>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Hesap Oluştur
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">veya</span>
        </div>
      </div>

      <OAuthButton mode="register" />
    </div>
  );
}
