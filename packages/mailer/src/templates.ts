import { renderEmail, type EmailBlock } from "./layout.js";

export type RenderedEmail = {
  template: string;
  subject: string;
  html: string;
  text: string;
};

type Brand = { name: string; color?: string };

function build(
  template: string,
  subject: string,
  heading: string,
  blocks: EmailBlock[],
  product?: string,
  brand?: Brand,
): RenderedEmail {
  const { html, text } = renderEmail({
    preheader: subject,
    heading,
    blocks,
    product,
    brand,
  });
  return { template, subject, html, text };
}

export const templates = {
  verifyEmail(p: { name: string; url: string }) {
    return build(
      "verify_email",
      "Confirmez votre adresse e-mail",
      "Bienvenue sur Kanso",
      [
        { kind: "p", text: `Bonjour ${p.name || ""},`.replace(" ,", ",") },
        {
          kind: "p",
          text: "Confirmez votre adresse e-mail pour sécuriser votre compte et publier votre assistant.",
        },
        { kind: "button", label: "Confirmer mon adresse", href: p.url },
        {
          kind: "muted",
          text: "Ce lien expire dans 24 heures. Si vous n'êtes pas à l'origine de cette inscription, ignorez cet e-mail.",
        },
      ],
    );
  },

  magicLink(p: { url: string }) {
    return build(
      "magic_link",
      "Votre lien de connexion Kanso",
      "Connexion à Kanso",
      [
        {
          kind: "p",
          text: "Cliquez sur le bouton ci-dessous pour vous connecter.",
        },
        { kind: "button", label: "Me connecter", href: p.url },
        {
          kind: "muted",
          text: "Ce lien est valable 20 minutes et ne peut servir qu'une fois.",
        },
      ],
    );
  },

  passwordReset(p: { url: string }) {
    return build(
      "password_reset",
      "Réinitialisation de votre mot de passe",
      "Nouveau mot de passe",
      [
        {
          kind: "p",
          text: "Une réinitialisation du mot de passe a été demandée pour votre compte.",
        },
        {
          kind: "button",
          label: "Choisir un nouveau mot de passe",
          href: p.url,
        },
        {
          kind: "muted",
          text: "Ce lien expire dans 1 heure. Si vous n'avez rien demandé, vous pouvez ignorer cet e-mail.",
        },
      ],
    );
  },

  invitation(p: { workspace: string; inviter: string; url: string }) {
    return build(
      "invitation",
      `${p.inviter} vous invite sur Kanso`,
      `Rejoindre ${p.workspace}`,
      [
        {
          kind: "p",
          text: `${p.inviter} vous invite à rejoindre l'espace « ${p.workspace} » sur Kanso.`,
        },
        { kind: "button", label: "Accepter l'invitation", href: p.url },
        { kind: "muted", text: "Cette invitation expire dans 7 jours." },
      ],
    );
  },

  newLead(p: {
    workspace: string;
    tier: "hot" | "warm" | "cold";
    score: number;
    event: string;
    rows: Array<[string, string]>;
    url: string;
  }) {
    const label =
      p.event === "escalation"
        ? "Demande de contact humain"
        : p.tier === "hot"
          ? "Demande prioritaire"
          : "Nouvelle demande";
    return build(
      "new_lead",
      `${label} — ${p.workspace} (${p.score}/100)`,
      label,
      [
        {
          kind: "p",
          text: `Votre assistant a qualifié une nouvelle demande pour ${p.workspace}.`,
        },
        { kind: "kv", rows: [["Score", `${p.score} / 100`], ...p.rows] },
        { kind: "button", label: "Voir la demande", href: p.url },
        {
          kind: "muted",
          text: "Qualification automatique indicative : vérifiez toujours la demande avant d'y donner suite.",
        },
      ],
    );
  },

  trialEnding(p: { workspace: string; daysLeft: number; url: string }) {
    const heading =
      p.daysLeft <= 0
        ? "Votre essai est terminé"
        : `Plus que ${p.daysLeft} jour${p.daysLeft > 1 ? "s" : ""} d'essai`;
    return build("trial_ending", `${heading} — ${p.workspace}`, heading, [
      {
        kind: "p",
        text:
          p.daysLeft <= 0
            ? "Votre assistant est en pause. Choisissez une offre pour le réactiver : vos réglages et vos demandes sont conservés."
            : "Choisissez une offre pour que votre assistant reste en ligne sans interruption.",
      },
      { kind: "button", label: "Choisir une offre", href: p.url },
    ]);
  },

  quotaWarning(p: {
    workspace: string;
    metric: string;
    pct: number;
    url: string;
  }) {
    return build(
      "quota_warning",
      `${p.pct >= 100 ? "Quota atteint" : `${p.pct} % du quota utilisé`} — ${p.workspace}`,
      p.pct >= 100 ? "Quota mensuel atteint" : "Quota bientôt atteint",
      [
        {
          kind: "p",
          text: `Vous avez utilisé ${p.pct} % de votre quota mensuel de ${p.metric}.`,
        },
        {
          kind: "p",
          text:
            p.pct >= 100
              ? "Les nouvelles demandes sont mises en pause jusqu'au mois prochain ou jusqu'au passage à une offre supérieure. Aucun dépassement n'est facturé."
              : "Passez à l'offre supérieure si vous prévoyez davantage de volume ce mois-ci.",
        },
        { kind: "button", label: "Gérer mon offre", href: p.url },
      ],
    );
  },

  documentAnomaly(p: {
    workspace: string;
    filename: string;
    reason: string;
    url: string;
  }) {
    return build(
      "document_anomaly",
      `Document à vérifier — ${p.filename}`,
      "Un document demande votre attention",
      [
        {
          kind: "p",
          text: `Le document « ${p.filename} » n'a pas pu être traité automatiquement.`,
        },
        { kind: "kv", rows: [["Motif", p.reason]] },
        { kind: "button", label: "Vérifier le document", href: p.url },
      ],
    );
  },

  paymentFailed(p: { workspace: string; url: string }) {
    return build(
      "payment_failed",
      `Échec de paiement — ${p.workspace}`,
      "Le paiement n'a pas abouti",
      [
        {
          kind: "p",
          text: "Le dernier prélèvement de votre abonnement Kanso a échoué. Mettez à jour votre moyen de paiement pour éviter une interruption.",
        },
        { kind: "button", label: "Mettre à jour le paiement", href: p.url },
      ],
    );
  },

  /** Internal notice to the Kanso team (sales / ops). */
  internalRequest(p: {
    kind: string;
    workspace: string;
    tenantId: string;
    requester: string;
    rows: Array<[string, string]>;
    url: string;
  }) {
    return build(
      "internal_request",
      `[${p.kind}] ${p.workspace}`,
      `Nouvelle demande : ${p.kind}`,
      [
        {
          kind: "p",
          text: `${p.requester} (${p.workspace}) vient de faire une demande depuis son espace.`,
        },
        { kind: "kv", rows: [["Espace", p.tenantId], ...p.rows] },
        { kind: "button", label: "Ouvrir dans le back-office", href: p.url },
      ],
      "Solutions",
    );
  },

  /** Acknowledgement for the public sites (contact, quote, waiting list). */
  contactAck(p: {
    name: string;
    product:
      | "Kanso Solutions"
      | "Kanso Assistant"
      | "Kanso Site"
      | "Kanso Portail";
    kind: "contact" | "devis" | "waitlist";
  }) {
    const hello = p.name ? `Bonjour ${p.name},` : "Bonjour,";
    const copy = {
      contact:
        "Nous avons bien reçu votre message. Un membre de l'équipe vous répond sous deux jours ouvrés.",
      devis:
        "Nous avons bien reçu votre demande de devis. Un membre de l'équipe vous recontacte sous deux jours ouvrés pour en discuter, sans engagement.",
      waitlist:
        "Vous êtes inscrit(e) sur la liste d'attente. Nous vous écrirons lorsque le produit s'ouvrira, et pour vous associer à sa conception si vous le souhaitez.",
    }[p.kind];
    const heading =
      p.kind === "waitlist"
        ? "Inscription enregistrée"
        : "Nous avons bien reçu votre demande";
    return build(
      "contact_ack",
      `${heading} — ${p.product}`,
      heading,
      [
        { kind: "p", text: hello },
        { kind: "p", text: copy },
        {
          kind: "muted",
          text: `${p.product} est édité par Kanso Solutions (SHBT-STUDIO SAS). Vos données ne servent qu'à répondre à cette demande.`,
        },
      ],
      p.product.replace("Kanso ", ""),
    );
  },

  websiteRequestAck(p: { workspace: string }) {
    return build(
      "website_request_ack",
      "Votre demande de site web",
      "Nous avons bien reçu votre demande",
      [
        {
          kind: "p",
          text: `Merci ! L'équipe Kanso Solutions revient vers vous sous deux jours ouvrés pour échanger sur le site de ${p.workspace} et vous proposer un devis.`,
        },
        {
          kind: "muted",
          text: "Votre assistant reste utilisable dès aujourd'hui : il sera installé sur votre nouveau site lors de sa mise en ligne.",
        },
      ],
    );
  },

  exportReady(p: { workspace: string; url: string }) {
    return build(
      "export_ready",
      `Export de données prêt — ${p.workspace}`,
      "Votre export est prêt",
      [
        {
          kind: "p",
          text: "L'export complet des données de votre espace est disponible.",
        },
        { kind: "button", label: "Télécharger l'export", href: p.url },
        {
          kind: "muted",
          text: "Le lien expire dans 24 heures et nécessite d'être connecté.",
        },
      ],
    );
  },

  // ---- Kanso Portail : e-mails au nom du cabinet ------------------------------
  portalInvite(p: { brand: Brand; clientName: string; title: string; url: string; items: string[]; message?: string | null; days: number }) {
    return build(
      "portal_invite",
      `${p.brand.name} vous demande des documents`,
      "Des documents vous sont demandés",
      [
        { kind: "p", text: p.clientName ? `Bonjour ${p.clientName},` : "Bonjour," },
        { kind: "p", text: `${p.brand.name} ouvre un dossier « ${p.title} » et vous demande de déposer quelques pièces, depuis votre téléphone ou votre ordinateur.` },
        ...(p.message ? [{ kind: "p" as const, text: p.message }] : []),
        ...(p.items.length ? [{ kind: "muted" as const, text: `À fournir : ${p.items.slice(0, 8).join(" · ")}${p.items.length > 8 ? " …" : ""}` }] : []),
        { kind: "button", label: "Déposer mes documents", href: p.url },
        { kind: "muted", text: `Ce lien est personnel et valable ${p.days} jours. Vous recevrez un code à six chiffres par e-mail pour confirmer que c'est bien vous. Ne le transmettez pas.` },
      ],
      undefined,
      p.brand,
    );
  },

  portalCode(p: { brand: Brand; code: string }) {
    return build(
      "portal_code",
      `Votre code de vérification : ${p.code}`,
      "Votre code de vérification",
      [
        { kind: "p", text: "Saisissez ce code pour accéder à votre dossier :" },
        { kind: "kv", rows: [["Code", p.code]] },
        { kind: "muted", text: "Il est valable 10 minutes. Si vous n'avez rien demandé, ignorez cet e-mail." },
      ],
      undefined,
      p.brand,
    );
  },

  portalResend(p: { brand: Brand; clientName: string; title: string; url: string; days: number }) {
    return build(
      "portal_resend",
      `Votre lien d'accès — ${p.title}`,
      "Votre nouveau lien d'accès",
      [
        { kind: "p", text: p.clientName ? `Bonjour ${p.clientName},` : "Bonjour," },
        { kind: "p", text: `Voici un nouveau lien pour accéder au dossier « ${p.title} ».` },
        { kind: "button", label: "Ouvrir mon dossier", href: p.url },
        { kind: "muted", text: `Valable ${p.days} jours. Les liens précédents ne fonctionnent plus.` },
      ],
      undefined,
      p.brand,
    );
  },

  portalReminder(p: { brand: Brand; clientName: string; title: string; url: string; missing: string[] }) {
    return build(
      "portal_reminder",
      `Il manque encore des documents — ${p.title}`,
      "Il manque encore des documents",
      [
        { kind: "p", text: p.clientName ? `Bonjour ${p.clientName},` : "Bonjour," },
        { kind: "p", text: `Pour avancer sur « ${p.title} », ${p.brand.name} attend encore :` },
        { kind: "muted", text: p.missing.slice(0, 10).join(" · ") },
        { kind: "button", label: "Déposer mes documents", href: p.url },
      ],
      undefined,
      p.brand,
    );
  },

  portalRefusal(p: { brand: Brand; clientName: string; title: string; url: string; label: string; reason: string }) {
    return build(
      "portal_refusal",
      `Un document est à refaire — ${p.title}`,
      "Un document est à refaire",
      [
        { kind: "p", text: p.clientName ? `Bonjour ${p.clientName},` : "Bonjour," },
        { kind: "p", text: `${p.brand.name} ne peut pas utiliser le document « ${p.label} ».` },
        ...(p.reason ? [{ kind: "p" as const, text: `Motif : ${p.reason}` }] : []),
        { kind: "button", label: "Déposer un nouveau document", href: p.url },
      ],
      undefined,
      p.brand,
    );
  },

  portalCabinetMessage(p: { brand: Brand; clientName: string; title: string; url: string; body: string }) {
    return build(
      "portal_message",
      `Nouveau message — ${p.title}`,
      "Vous avez un nouveau message",
      [
        { kind: "p", text: p.clientName ? `Bonjour ${p.clientName},` : "Bonjour," },
        { kind: "p", text: `${p.brand.name} vous a écrit à propos de « ${p.title} » :` },
        { kind: "muted", text: p.body },
        { kind: "button", label: "Ouvrir mon dossier", href: p.url },
      ],
      undefined,
      p.brand,
    );
  },

  portalPurgeNotice(p: { brand: Brand; title: string; date: string }) {
    return build(
      "portal_purge_notice",
      `Fin de conservation du dossier — ${p.title}`,
      "Dossier bientôt supprimé",
      [
        { kind: "p", text: `Conformément à sa durée de conservation, les documents du dossier « ${p.title} » seront supprimés le ${p.date}.` },
        { kind: "muted", text: "Exportez-les avant cette date si vous souhaitez les conserver." },
      ],
      undefined,
      p.brand,
    );
  },

  portalCabinetDigest(p: { workspace: string; url: string; rows: Array<[string, string]> }) {
    return build(
      "portal_digest",
      `Portail — activité de la veille (${p.workspace})`,
      "Activité sur vos dossiers",
      [
        { kind: "p", text: "Voici ce qui s'est passé depuis le dernier résumé :" },
        { kind: "kv", rows: p.rows },
        { kind: "button", label: "Ouvrir le portail", href: p.url },
      ],
      "Portail",
    );
  },

  portalDossierComplete(p: { workspace: string; reference: string; title: string; client: string; url: string }) {
    return build(
      "portal_complete",
      `Dossier complet — ${p.reference}`,
      "Un dossier est complet",
      [
        { kind: "p", text: `${p.client || "Votre client"} a déposé toutes les pièces demandées pour « ${p.title} » (${p.reference}).` },
        { kind: "button", label: "Vérifier les pièces", href: p.url },
      ],
      "Portail",
    );
  },

  portalCabinetPurgeNotice(p: { workspace: string; reference: string; title: string; date: string; url: string }) {
    return build(
      "portal_cabinet_purge_notice",
      `Suppression prochaine — ${p.reference}`,
      "Un dossier sera supprimé",
      [
        { kind: "p", text: `Le dossier « ${p.title} » (${p.reference}) sera supprimé le ${p.date}, selon la durée de conservation de ${p.workspace}.` },
        { kind: "button", label: "Exporter le dossier", href: p.url },
      ],
      "Portail",
    );
  },
};
