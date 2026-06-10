import { Suspense } from "react";
import { StudentLoginForm } from "@/components/student/student-login-form";
import { SparcRobot } from "@/components/student/sparc/sparc-robot";

export const metadata = {
  title: "Sign In — Little Logic Adventure",
  description: "Enter your Student ID to play robot coding challenges.",
};

export default function StudentLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F8FAFC]">
          <SparcRobot size="sm" />
          <p className="text-lg font-semibold text-indigo-700">Loading…</p>
        </div>
      }
    >
      <StudentLoginForm />
    </Suspense>
  );
}
