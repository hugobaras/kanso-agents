import { PAID_PLANS, PLANS, TRIAL_DAYS } from "@kanso/billing";
import type { Metadata } from "next";
import { Faq } from "@/components/marketing/faq";
import { PricingGrid } from "@/components/marketing/pricing-grid";

export const metadata: Metadata = {
  title: "Tarifs",
  description: "Trois offres sans engagement, à partir de 49 € HT par mois. 14 jours d'essai gratuit, sans carte bancaire.",
};

const COMPARE: Array<[string, string, string, string]> = [
  ["Conversations qualifiées / mois", "200", "600", "2 000"],
  ["Documents traités / mois", "—", "150", "800"],
  ["Utilisateurs", "2", "5", "15"],
  ["Questions et score sur mesure", "✓", "✓", "✓"],
  ["Alertes e-mail", "✓", "✓", "✓"],
  ["Alertes Slack", "—", "✓", "✓"],
  ["CRM HubSpot, agenda Calendly", "—", "✓", "✓"],
  ["Pennylane (brouillons comptables)", "—", "✓", "✓"],
  ["Sellsy, Google Agenda", "—", "—", "✓"],
  ["Intégrations sur mesure", "Sur devis", "Sur devis", "Incluses (étude)"],
  ["Support", "E-mail", "E-mail", "Prioritaire"],
];

export default function PricingPage() {
  const plans = PAID_PLANS.map((id) => PLANS[id]);
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 text-center">
        <h1 className="font-display text-5xl">Des tarifs simples, sans surprise.</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          {TRIAL_DAYS} jours d&apos;essai complet, sans carte bancaire. Aucun dépassement facturé : au-delà du quota, l&apos;assistant
          se met poliment en pause.
        </p>
        <PricingGrid plans={plans} />
      </section>
      <section className="mx-auto max-w-5xl px-5 pb-20">
        <h2 className="mb-6 font-display text-3xl">Comparer les offres</h2>
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-5 py-3 font-medium text-muted"> </th>
                {plans.map((p) => (
                  <th key={p.id} className="px-5 py-3 text-center font-display text-lg font-semibold">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map(([label, ...vals]) => (
                <tr key={label} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 text-ink/90">{label}</td>
                  {vals.map((v, i) => (
                    <td key={i} className={`px-5 py-3 text-center ${v === "—" ? "text-subtle" : ""}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted">Prix hors taxes, TVA française applicable. Paiement sécurisé via Stripe.</p>
        <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-xl border border-line bg-surface p-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold">Besoin d&apos;un site internet ?</p>
            <p className="mt-1 text-sm text-muted">
              Création ou refonte par Kanso Solutions, assistant intégré. Prestation sur devis, indépendante de l&apos;abonnement.
            </p>
          </div>
          <a href="/site-internet" className="shrink-0 text-sm font-medium text-accent hover:underline">
            En savoir plus →
          </a>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-5 pb-24">
        <h2 className="text-center font-display text-3xl">Questions fréquentes</h2>
        <Faq />
      </section>
    </>
  );
}
