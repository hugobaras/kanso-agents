import type { Metadata, Viewport } from "next";
import { Newsreader, Poppins } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

// next/font self-hosts the files at build time: no request to Google at runtime.
const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});
const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"),
  title: {
    default: "Kanso Assistant — L'assistant d'accueil des cabinets",
    template: "%s · Kanso Assistant",
  },
  description:
    "Kanso Assistant qualifie les demandes de vos futurs clients et traite vos factures fournisseurs. Pour avocats, experts-comptables et notaires. Hébergé dans l'Union européenne.",
  icons: { icon: "/brand/favicon-assistant.svg" },
};

export const viewport: Viewport = {
  themeColor: "#faf8f4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${poppins.variable} ${serif.variable}`}>
      <body className="min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
