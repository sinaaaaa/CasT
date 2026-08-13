import { cn } from "@/lib/utils";

const LINKEDIN_URL = "https://www.linkedin.com/in/sina-zandi";

type SiteFooterProps = {
  /** Light pages (student / edu shells). Dark for auth screens. */
  variant?: "light" | "dark";
  className?: string;
};

/**
 * Shared credit footer — LinkedIn link + dynamic copyright year.
 */
export function SiteFooter({ variant = "light", className }: SiteFooterProps) {
  const year = new Date().getFullYear();
  const dark = variant === "dark";

  return (
    <footer
      className={cn(
        "px-4 py-5 text-center sm:px-6",
        dark
          ? "border-t border-white/10"
          : "border-t border-indigo-100/60",
        className
      )}
    >
      <p
        className={cn(
          "mx-auto max-w-3xl text-xs leading-relaxed sm:text-sm",
          dark ? "text-slate-400" : "text-slate-500"
        )}
      >
        Made with ❤️ by{" "}
        <a
          href={LINKEDIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "font-semibold underline-offset-2 transition-colors hover:underline",
            dark
              ? "text-indigo-300 hover:text-indigo-200"
              : "text-indigo-700 hover:text-indigo-500"
          )}
        >
          Sina Zandi
        </a>
        {" · "}
        © {year} Sina Zandi. All rights reserved.
      </p>
    </footer>
  );
}
