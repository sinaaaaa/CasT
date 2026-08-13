import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { SiteFooter } from "@/components/site-footer";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900">
      <div className="flex flex-1 items-center justify-center p-6">
        <Suspense fallback={<p className="text-white">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
      <SiteFooter variant="dark" />
    </div>
  );
}
