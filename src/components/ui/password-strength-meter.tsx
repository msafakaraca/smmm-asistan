"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Check, X, Shield, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";

interface PasswordCriteria {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

export type PasswordStrength = "empty" | "weak" | "fair" | "strong" | "very-strong";

interface PasswordStrengthMeterProps {
  password: string;
  showCriteria?: boolean;
  className?: string;
}

function checkPasswordCriteria(password: string): PasswordCriteria {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };
}

function calculateStrength(password: string): { strength: PasswordStrength; score: number } {
  if (!password) {
    return { strength: "empty", score: 0 };
  }

  const criteria = checkPasswordCriteria(password);
  let score = 0;

  // Temel puan - karakter sayısı
  if (password.length >= 6) score += 10;
  if (password.length >= 8) score += 15;
  if (password.length >= 10) score += 15;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // Kriter puanları
  if (criteria.hasUppercase) score += 10;
  if (criteria.hasLowercase) score += 10;
  if (criteria.hasNumber) score += 10;
  if (criteria.hasSpecialChar) score += 15;

  // Çeşitlilik bonusu
  const varietyCount = [
    criteria.hasUppercase,
    criteria.hasLowercase,
    criteria.hasNumber,
    criteria.hasSpecialChar,
  ].filter(Boolean).length;

  if (varietyCount >= 3) score += 5;
  if (varietyCount === 4) score += 5;

  // Skor'a göre güç belirleme
  let strength: PasswordStrength;
  if (score < 25) {
    strength = "weak";
  } else if (score < 50) {
    strength = "fair";
  } else if (score < 75) {
    strength = "strong";
  } else {
    strength = "very-strong";
  }

  return { strength, score: Math.min(100, score) };
}

const strengthConfig: Record<
  PasswordStrength,
  { label: string; color: string; bgColor: string; icon: typeof Shield }
> = {
  empty: {
    label: "",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    icon: ShieldOff,
  },
  weak: {
    label: "Zayıf",
    color: "text-red-500",
    bgColor: "bg-red-500",
    icon: ShieldOff,
  },
  fair: {
    label: "Orta",
    color: "text-orange-500",
    bgColor: "bg-orange-500",
    icon: ShieldAlert,
  },
  strong: {
    label: "Güçlü",
    color: "text-green-500",
    bgColor: "bg-green-500",
    icon: ShieldCheck,
  },
  "very-strong": {
    label: "Çok Güçlü",
    color: "text-emerald-600",
    bgColor: "bg-emerald-600",
    icon: Shield,
  },
};

const criteriaLabels: Record<keyof PasswordCriteria, string> = {
  minLength: "En az 8 karakter",
  hasUppercase: "Büyük harf (A-Z)",
  hasLowercase: "Küçük harf (a-z)",
  hasNumber: "Rakam (0-9)",
  hasSpecialChar: "Özel karakter (!@#$%...)",
};

export function PasswordStrengthMeter({
  password,
  showCriteria = false,
  className,
}: PasswordStrengthMeterProps) {
  const { strength, score } = useMemo(() => calculateStrength(password), [password]);
  const criteria = useMemo(() => checkPasswordCriteria(password), [password]);
  const config = strengthConfig[strength];
  const Icon = config.icon;

  if (strength === "empty") {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Progress bar ve label */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Icon className={cn("h-4 w-4", config.color)} />
            <span className={cn("text-sm font-medium", config.color)}>
              {config.label}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{score}%</span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full transition-all duration-300 ease-out",
              config.bgColor
            )}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Kriterler */}
      {showCriteria && (
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          {(Object.keys(criteria) as Array<keyof PasswordCriteria>).map((key) => {
            const met = criteria[key];
            return (
              <div
                key={key}
                className={cn(
                  "flex items-center gap-1.5 transition-colors",
                  met ? "text-green-600" : "text-muted-foreground"
                )}
              >
                {met ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )}
                <span>{criteriaLabels[key]}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { checkPasswordCriteria, calculateStrength };
