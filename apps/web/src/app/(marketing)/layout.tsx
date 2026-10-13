import { SiteFooter, SiteHeader } from "@/components/sites/chrome";
import { siteHref, themeStyle } from "@/lib/sites";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={themeStyle("assistant")}>
      <SiteHeader
        site="assistant"
        links={[
          { href: "/#fonctionnement", label: "Fonctionnement" },
          { href: "/cas-usage/avocats", label: "Avocats" },
          { href: "/cas-usage/experts-comptables", label: "Experts-comptables" },
          { href: "/cas-usage/notaires", label: "Notaires" },
          { href: "/tarifs", label: "Tarifs" },
          { href: "/securite", label: "Sécurité" },
        ]}
        login={{ href: "/connexion", label: "Connexion" }}
        cta={{ href: "/inscription", label: "Essai gratuit" }}
      />
      <main>{children}</main>
      <SiteFooter
        site="assistant"
        legal={[
          { href: "/legal/cgu", label: "Conditions d'utilisation" },
          { href: "/legal/cgv", label: "Conditions de vente" },
          { href: "/legal/confidentialite", label: "Confidentialité" },
          { href: "/legal/dpa", label: "Accord de traitement (DPA)" },
          { href: "/legal/sous-traitants", label: "Sous-traitants" },
          { href: siteHref("solutions", "/mentions-legales"), label: "Mentions légales" },
        ]}
      />
    </div>
  );
}
