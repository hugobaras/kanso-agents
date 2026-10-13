const STRINGS = {
  fr: {
    open: "Ouvrir l'assistant",
    close: "Fermer",
    restart: "Nouvelle conversation",
    placeholder: "Écrivez votre message…",
    send: "Envoyer",
    typing: "L'assistant écrit…",
    bot: "Assistant automatisé",
    ended: "Conversation terminée.",
    newConversation: "Démarrer une nouvelle conversation",
    network: "Connexion impossible. Vérifiez votre réseau et réessayez.",
    error: "Une erreur est survenue. Réessayez dans un instant.",
    privacy: "Données personnelles",
    poweredBy: "Propulsé par Kanso",
    you: "Vous",
    assistant: "Assistant",
    chatLabel: "Discussion avec l'assistant",
  },
  en: {
    open: "Open the assistant",
    close: "Close",
    restart: "New conversation",
    placeholder: "Type your message…",
    send: "Send",
    typing: "The assistant is typing…",
    bot: "Automated assistant",
    ended: "Conversation ended.",
    newConversation: "Start a new conversation",
    network: "Connection failed. Check your network and try again.",
    error: "Something went wrong. Please try again shortly.",
    privacy: "Privacy",
    poweredBy: "Powered by Kanso",
    you: "You",
    assistant: "Assistant",
    chatLabel: "Chat with the assistant",
  },
} as const;

export type Locale = keyof typeof STRINGS;
export type Strings = (typeof STRINGS)[Locale];

export function pickLocale(configLocale: string | undefined, nav = typeof navigator !== "undefined" ? navigator.language : "fr"): Locale {
  if (configLocale === "en" || configLocale === "fr") return configLocale;
  return nav?.toLowerCase().startsWith("en") ? "en" : "fr";
}

export function t(locale: Locale): Strings {
  return STRINGS[locale];
}
