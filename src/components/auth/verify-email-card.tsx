"use client";

import { useState } from "react";
import { MailCheck, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { resendVerificationEmail } from "@/lib/actions/auth-supabase";

export function VerifyEmailCard() {
  const [isResending, setIsResending] = useState(false);

  async function handleResend() {
    setIsResending(true);
    try {
      const result = await resendVerificationEmail();

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Doğrulama emaili tekrar gönderildi");
    } catch {
      toast.error("Email gönderilemedi");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-primary/10 p-4">
            <MailCheck className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl">Email Doğrulama</CardTitle>
        <CardDescription>
          Hesabınızı aktifleştirmek için email adresinize gönderilen bağlantıya
          tıklayın.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
          <p>
            Email adresinize bir doğrulama bağlantısı gönderdik. Lütfen gelen
            kutunuzu kontrol edin. Spam klasörünü de kontrol etmeyi unutmayın.
          </p>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleResend}
          disabled={isResending}
        >
          {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Tekrar Gönder
        </Button>
      </CardContent>
    </Card>
  );
}
