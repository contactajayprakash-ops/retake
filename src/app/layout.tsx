import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Retake",
    template: "%s · Retake",
  },
  description: "Turn any practice test into a live class review game, then see which questions everyone missed.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://retake.vercel.app"),
  openGraph: {
    title: "Retake",
    description: "Turn any practice test into a live class review game, then see which questions everyone missed.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef2ec" },
    { media: "(prefers-color-scheme: dark)", color: "#121814" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
