import type { Metadata } from "next";
import { Inter, Bungee, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SessionProviderWrapper } from "@/components/SessionProviderWrapper";
import { Tracker } from "@/components/Tracker";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/seo";
import { indexingAllowed, siteUrl } from "@/lib/site";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// IceBox's brand display font (see charte graphique) — used only for the
// wordmark/headings; Bungee ships one weight (400).
const bungee = Bungee({
  variable: "--font-bungee",
  subsets: ["latin"],
  weight: "400",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  // Closed to search engines until SITE_INDEXABLE=1 (see src/lib/site.ts).
  robots: indexingAllowed() ? { index: true, follow: true } : { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr-CA"
      className={`${inter.variable} ${bungee.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
        <Tracker />
      </body>
    </html>
  );
}
