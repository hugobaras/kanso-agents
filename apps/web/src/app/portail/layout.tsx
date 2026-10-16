import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/sites/chrome";
import { siteHref, themeStyle } from "@/lib/sites";

export const metadata: Metadata = {
  title: { absolute: "Kanso Portail — L'espace client sécurisé de votre cabinet ", template: "%s · Kanso Portail" },
  description:
    "Kanso Portail, l'espace client sécurisé des avocats, experts-comptables et notaires : dépôt de pièces, suivi de dossier, échanges. 14 jours d'essai gratuit.",
  icons: { icon: "/brand/favicon-portail.svg" },
};

export default function PortailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={themeStyle("portail")}>
      <SiteHeader
        site="portail"
        links={[
          { href: siteHref("portail", "/#fonctionnement"), label: "Comment ça marche" },
          { href: siteHref("portail", "/#fonctions"), label: "Fonctions" },
          { href: siteHref("portail", "/#assistant"), label: "Avec Kanso Assistant" },
          { href: siteHref("portail", "/#questions"), label: "Questions" },
        ]}
        cta={{ href: "/inscription?produit=portail", label: "Essayer gratuitement" }}
        login={{ href: "/connexion?produit=portail", label: "Se connecter" }}
      />
      <main>{children}</main>
      <SiteFooter site="portail" />
    </div>
  );
}
