import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/sites/chrome";
import { siteHref, themeStyle } from "@/lib/sites";

export const metadata: Metadata = {
  title: { absolute: "Kanso Site — Le site internet de votre cabinet, conçu sur mesure", template: "%s · Kanso Site" },
  description:
    "Kanso Site conçoit le site des avocats, experts-comptables et notaires : design sur mesure, contenus rédigés pour votre profession, conformité prise en compte. Devis gratuit.",
  icons: { icon: "/brand/favicon-site.svg" },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={themeStyle("site")}>
      <SiteHeader
        site="site"
        links={[
          { href: siteHref("site", "/#inclus"), label: "Ce qui est inclus" },
          { href: siteHref("site", "/#professions"), label: "Votre profession" },
          { href: siteHref("site", "/#demarche"), label: "Démarche" },
          { href: siteHref("site", "/#questions"), label: "Questions" },
        ]}
        cta={{ href: siteHref("site", "/devis"), label: "Demander un devis" }}
      />
      <main>{children}</main>
      <SiteFooter site="site" />
    </div>
  );
}
