export const ASSISTANT_FAQ: Array<[string, string]> = [
  [
    "L'assistant peut-il donner un conseil juridique ou comptable ?",
    "Non. Il l'indique dès le premier message, refuse poliment toute demande de conseil et propose de transmettre les coordonnées du visiteur à votre équipe. Vous restez seul juge de la suite à donner.",
  ],
  [
    "Où sont hébergées les données ?",
    "Dans l'Union européenne : application hébergée chez OVHcloud en France, base de données en UE, modèles d'IA Mistral (société française) via leur point d'accès européen. La liste complète de nos sous-traitants est publique.",
  ],
  [
    "Faut-il un développeur pour l'installer ?",
    "Non. Vous copiez une ligne de code dans votre site (guides WordPress, Wix, Squarespace fournis) ou vous la transmettez à votre prestataire. L'espace vérifie automatiquement que l'installation fonctionne.",
  ],
  [
    "Que se passe-t-il si je dépasse mon quota ?",
    "Rien n'est facturé en plus. Vous êtes prévenu à 80 % puis à 100 % ; au-delà, l'assistant invite poliment le visiteur à contacter le cabinet directement jusqu'au mois suivant ou jusqu'à un changement d'offre.",
  ],
  [
    "La qualification est-elle fiable ?",
    "Elle est indicative. Kanso applique vos propres critères et vous transmet toujours la conversation complète : vous gardez la main sur chaque décision. Nous nous engageons sur les moyens mis en œuvre, pas sur un nombre de clients.",
  ],
  [
    "Puis-je résilier à tout moment ?",
    "Oui, en un clic depuis la page Facturation. Vous pouvez exporter toutes vos données à tout moment, et supprimer votre espace en libre-service.",
  ],
];

export function Faq({ items = ASSISTANT_FAQ }: { items?: Array<[string, string]> }) {
  return (
    <div className="mt-10 divide-y divide-line border-y border-line">
      {items.map(([q, a]) => (
        <details key={q} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-medium">
            {q}
            <span className="text-2xl leading-none text-subtle transition-transform group-open:rotate-45" aria-hidden>
              +
            </span>
          </summary>
          <p className="mt-3 text-[15px] leading-7 text-muted">{a}</p>
        </details>
      ))}
    </div>
  );
}
