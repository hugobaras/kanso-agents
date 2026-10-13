import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/sites/chrome";
import { siteHref, themeStyle } from "@/lib/sites";

export const metadata: Metadata = {
  title: { absolute: "Kanso Portail — L'espace client sécurisé de votre cabinet (bientôt)", template: "%s · Kanso Portail" },
  description:
    "Kanso Portail, l'espace client sécurisé des avocats, experts-comptables et notaires : dépôt de pièces, suivi de dossier, échanges. En conception — rejoignez la liste d'attente.",
  icons: { icon: "/brand/favicon-portail.svg" },
};

export default function PortailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={themeStyle("portail")}>
      <SiteHeader
        site="portail"
        links={[
          { href: siteHref("portail", "/#fonctions"), label: "Ce qu'il fera" },
          { href: siteHref("portail", "/#assistant"), label: "Avec Kanso Assistant" },
          { href: siteHref("portail", "/#questions"), label: "Questions" },
        ]}
        cta={{ href: siteHref("portail", "/#liste-attente"), label: "Liste d'attente" }}
      />
      <main>{children}</main>
      <SiteFooter site="portail" />
    </div>
  );
}
