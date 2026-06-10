import { redirect } from "next/navigation";

/** CT construct catalog and per-level weights are no longer used. */
export default function CTConstructsPage() {
  redirect("/teacher/levels");
}
