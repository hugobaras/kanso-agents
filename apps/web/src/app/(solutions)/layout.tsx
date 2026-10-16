import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/sites/chrome";
import { siteHref, themeStyle } from "@/lib/sites";

export const metadata: Metadata = {
  title: { absolute: "Kanso Solutions — Des outils simples pour les professions du droit et du chiffre", template: "%s · Kanso Solutions" },
  description:
    "Kanso Solutions conçoit un site, un assistant et un espace client pour les avocats, experts-comptables et notaires. Hébergé dans l'Union européenne.",
  icons: { icon: "/brand/favicon-solutions.svg" },
};

export default function SolutionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={themeStyle("solutions")}>
      <SiteHeader
        site="solutions"
        links={[
          { href: siteHref("solutions", "/#produits"), label: "Produits" },
          { href: siteHref("solutions", "/#approche"), label: "Notre approche" },
          { href: siteHref("site"), label: "Kanso Site" },
          { href: siteHref("assistant"), label: "Kanso Assistant" },
          { href: siteHref("portail"), label: "Kanso Portail" },
        ]}
        cta={{ href: siteHref("solutions", "/contact"), label: "Nous contacter" }}
      />
      <main>{children}</main>
      <SiteFooter site="solutions" />
    </div>
  );
}
