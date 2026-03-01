import { SetPasswordForm } from "@/components/auth/set-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Hesabınızı Tamamlayın</CardTitle>
          <CardDescription>
            Google ile giriş yaptınız. Lütfen bir şifre belirleyin ve ofis
            bilgilerinizi girin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SetPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
