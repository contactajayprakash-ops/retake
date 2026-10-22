"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// ---------------------------------------------------------------------------
// Buttons: the primary one is a filled-in bubble's colour, the quiet one is
// drawn like a box on a form. Both have a 2px ink border so they still read
// on a washed-out projector.
// ---------------------------------------------------------------------------

type Variant = "primary" | "quiet" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-mark text-mark-ink border-mark hover:brightness-110",
  quiet: "bg-transparent text-ink border-ink hover:bg-paper-2",
  danger: "bg-transparent text-redpen border-redpen hover:bg-paper-2",
};

const sizes = {
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof sizes }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-form border-2 font-semibold transition-[filter,background-color] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  size?: keyof typeof sizes;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-form border-2 font-semibold transition-[filter,background-color] ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page chrome
// ---------------------------------------------------------------------------

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-bold text-xl tracking-tight ${className}`}>
      <span className="inline-block h-5 w-5 rounded-full border-2 border-ink bg-ink" aria-hidden />
      Retake
    </Link>
  );
}

export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 py-4 sm:px-8">
        <div className={`mx-auto flex items-center justify-between ${wide ? "max-w-7xl" : "max-w-4xl"}`}>
          <Wordmark />
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/join" className="font-semibold underline-offset-4 hover:underline">
              Join a game
            </Link>
          </nav>
        </div>
      </header>
      <main className={`mx-auto w-full flex-1 px-4 pb-16 sm:px-8 ${wide ? "max-w-7xl" : "max-w-4xl"}`}>{children}</main>
      <footer className="px-4 py-6 text-sm text-graphite sm:px-8">
        <div className={`mx-auto flex flex-wrap items-center justify-between gap-2 ${wide ? "max-w-7xl" : "max-w-4xl"}`}>
          <span>Free, no accounts. Your questions stay on your link.</span>
          <a href="https://github.com/contactajayprakash-ops/retake" className="underline-offset-4 hover:underline">
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error"; children: ReactNode }) {
  const look = {
    info: "border-rule bg-paper-2 text-ink",
    warn: "border-highlighter bg-highlighter text-highlighter-ink",
    error: "border-redpen text-redpen bg-paper-2",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-form border-2 px-4 py-3 text-sm ${look}`}>
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-graphite">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-form border-2 border-ink bg-paper px-3 py-2 text-base text-ink placeholder:text-graphite disabled:opacity-50";
