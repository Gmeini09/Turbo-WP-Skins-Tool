# Turbo Designs Creator Suite

One-page website for the Turbo Designs Discord shop, Soundpack Creator and Weapon Skin Creator.

The shop includes seven categories. All purchases and support requests go to Discord. Catalog prices and estimated delivery times are confirmed in a private ticket.
Both product presentations live on the homepage; old product URLs redirect to their corresponding sections.
Animations respect reduced-motion preferences and content remains available without JavaScript.

Run locally with Node.js 20+: npm start, then open http://localhost:3000.
Railway uses npm start. Healthcheck: /health.

All public pages, scripts and assets live in public/. The server serves only this directory.
All purchase and support links point to https://discord.gg/turbodesigns.

The existing operator and privacy placeholders in public/impressum.html and public/datenschutz.html still require the owner's actual details.

## Studio redesign

The storefront includes product search, category filters, price sorting, device-local favorites, dark/light appearance, a six-item expandable portfolio, skin preview selection and device-local briefing drafts including thumbnail references. The existing Discord feed and explicit request submission remain in app.js; storefront.js adds browser-local interactions. Public catalog data is validated by discord-feed.js. No new dependencies are required. Local persistence is documented in public/datenschutz.html.

## Website orders

Website orders and partnerships require Discord authorization. A signed internal OAuth bridge on the existing bot exchanges the code; no client secret or Discord access token is delivered to the browser. The website stores an encrypted HttpOnly session and forwards only server-verified identity. Signed orders enter the existing Discord Shop Order Center with native registry, team controls, permissions and retry deduplication. Partnerships enter the existing partnerApplications inbox. Visible thumbnail labels are numbered sequentially after curation while original image identities stay stable. Soundpack Tool plans are priced at EUR 20 lifetime, EUR 15 month, EUR 10 week by the bot. The weapon skin tool is coming soon. NVE and sound previews use their dedicated Discord channels. Gallery curation uses Discord attachment IDs so incoming posts cannot shift the removed or deferred thumbnails. Run npm test for the website checks.

## Product presentation and local previews

The homepage starts with the Soundpack Creator, published plan prices and a direct order action. The request form maintains a live summary and preserves the Discord-only native ticket workflow. Offer details use native revision allowances. Verified reviews come only from published native Discord review messages, with up to six recent cards and original source links.

Visitors can preview a WAV file locally (16 MB limit) and compare two local PNG/JPG/WebP screenshots (10 MB each, matching aspect ratio). Files are not uploaded. Static verified NVE comparisons can also be configured in public/preview-content.json using local assets or approved Discord attachment URLs; never substitute filtered images for real paired screenshots. The old imprint template and its links were removed at the user's request.
