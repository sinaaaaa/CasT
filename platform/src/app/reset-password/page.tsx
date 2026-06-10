import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-6">
      <Suspense fallback={<p className="text-white">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
