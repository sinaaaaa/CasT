import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { SiteFooter } from "@/components/site-footer";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900">
      <div className="flex flex-1 items-center justify-center p-6">
        <ForgotPasswordForm />
      </div>
      <SiteFooter variant="dark" />
    </div>
  );
}
