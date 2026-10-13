import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

// next/font self-hosts the files at build time: no request to Google at runtime.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"),
  title: {
    default: "Kanso — L'assistant d'accueil des cabinets",
    template: "%s · Kanso",
  },
  description:
    "Kanso qualifie les demandes de vos futurs clients et traite vos factures fournisseurs. Pour avocats, experts-comptables et notaires. Hébergé dans l'Union européenne.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#faf8f4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${serif.variable}`}>
      <body className="min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
