import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Espace documents" },
  description: "Espace sécurisé de dépôt de documents.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function EspaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
