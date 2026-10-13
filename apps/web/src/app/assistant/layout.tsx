import { SiteFooter, SiteHeader } from "@/components/sites/chrome";
import { siteHref, themeStyle } from "@/lib/sites";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={themeStyle("assistant")}>
      <SiteHeader
        site="assistant"
        links={[
          { href: siteHref("assistant", "/#fonctionnement"), label: "Fonctionnement" },
          { href: siteHref("assistant", "/cas-usage/avocats"), label: "Avocats" },
          { href: siteHref("assistant", "/cas-usage/experts-comptables"), label: "Experts-comptables" },
          { href: siteHref("assistant", "/cas-usage/notaires"), label: "Notaires" },
          { href: siteHref("assistant", "/tarifs"), label: "Tarifs" },
          { href: siteHref("assistant", "/securite"), label: "Sécurité" },
        ]}
        login={{ href: "/connexion", label: "Connexion" }}
        cta={{ href: "/inscription", label: "Essai gratuit" }}
      />
      <main>{children}</main>
      <SiteFooter
        site="assistant"
        legal={[
          { href: siteHref("assistant", "/legal/cgu"), label: "Conditions d'utilisation" },
          { href: siteHref("assistant", "/legal/cgv"), label: "Conditions de vente" },
          { href: siteHref("assistant", "/legal/confidentialite"), label: "Confidentialité" },
          { href: siteHref("assistant", "/legal/dpa"), label: "Accord de traitement (DPA)" },
          { href: siteHref("assistant", "/legal/sous-traitants"), label: "Sous-traitants" },
          { href: siteHref("solutions", "/mentions-legales"), label: "Mentions légales" },
        ]}
      />
    </div>
  );
}
