# Turbo WP Skins Tool – GitHub Ready

Preview-/Verkaufswebsite für Turbo Designs.

## Zahlung

Die Seite ist auf **PayPal · 14,99 € einmalig** umgestellt.

In `config.js` fehlt nur noch dein echter PayPal Payment Link bzw. PayPal.Me-Link:

```js
window.PST_SHOP = {
  paypalUrl: "DEIN_PAYPAL_LINK",
  sellerEmail: "pgmeini@outlook.com",
  price: "14,99 €",
  discordUrl: "https://discord.gg/turbodesigns"
};
```

Danach funktionieren alle Kaufbuttons direkt.

## Hosting

Alle Dateien direkt in das GitHub-Repo `Gmeini09/Turbo-WP-Skins-Tool` hochladen und vorhandene Dateien ersetzen. Railway nutzt `npm start`.
