import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-manrope", display: "swap" });
// MTTM Lettering: the brand's own display face (brand guidelines, Appendix 13).
const mttm = localFont({
  src: [
    { path: "./fonts/mttm-lettering-regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/mttm-lettering-heavy.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-mttm",
  display: "swap",
  fallback: ["sans-serif"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Coach Console",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Coach Console", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#B7C0AE",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${mttm.variable}`}>
      <body>{children}</body>
    </html>
  );
}
