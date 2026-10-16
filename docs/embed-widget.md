# Widget Kanso — intégration

Le code d'intégration de chaque espace est affiché dans **Installation** (tableau de bord).

```html
<script src="https://api.kanso.fr/widget/kanso-widget.js" data-key="pk_live_…" data-api="https://api.kanso.fr" async></script>
```

| Attribut | Rôle |
|---|---|
| `data-key` | Clé publique de l'espace (obligatoire). Non secrète ; régénérable par le propriétaire. |
| `data-api` | URL de l'API (par défaut : origine du script). |
| `data-position` | `right` (défaut) ou `left`. |
| `data-open` | `true` pour ouvrir le panneau au chargement (démo, test). |

## Sécurité

- **Domaines autorisés** : liste par clé (Installation › Autorisez vos domaines). Exact (`https://www.cabinet.fr`) ou joker (`https://*.cabinet.fr`). Sans liste, toute origine est acceptée — l'interface le signale.
- `localhost` est accepté pour les clés `pk_test_` et hors production.
- Rate limit : 10 sessions/min/IP, 20 messages/min/session.
- Quota mensuel de conversations décompté au **premier message** du visiteur. Au-delà : message poli, aucun dépassement facturé.
- Espace inactif (essai terminé, suspendu) ou assistant non publié : le widget **ne s'affiche pas** sur le site.

## Comportement

- Shadow DOM fermé : aucun conflit de styles avec le site hôte.
- Langue : config de l'assistant, puis langue du navigateur (fr / en).
- Couleur : celle de l'espace ; le texte passe en foncé si le contraste blanc < 4,5:1.
- Accessibilité : `role="dialog"`, journal `aria-live`, Échap pour fermer, plein écran et piège de focus sous 640 px, `prefers-reduced-motion` respecté.
- Reprise de conversation dans l'onglet (`sessionStorage`), bouton « nouvelle conversation ».
- Aucun cookie déposé ; lien « Données personnelles » vers `/legal/confidentialite-widget`.

## Événements (pour la page hôte)

```js
window.addEventListener("kanso:session", (e) => console.log(e.detail.sessionId));
window.addEventListener("kanso:turn", (e) => console.log(e.detail.state));
window.KansoWidget.open(); // ou window.dispatchEvent(new CustomEvent("kanso:open"))
```

## Pilotes (ancien snippet `data-tenant`)

L'ancienne API `/v1/:tenantId/*` n'est servie qu'avec `KANSO_LEGACY_WIDGET=1`. Remplacer le snippet par la version `data-key` (Installation) puis retirer la variable.
