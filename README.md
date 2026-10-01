# Turbo Designs Creator Website

Deployment-ready Node.js static site for Railway.

## Local start
```bash
npm start
```
Open http://localhost:3000

## Railway
1. Push this folder to a GitHub repository.
2. Create a Railway service from the repository.
3. Railway detects Node automatically.
4. Start command: `npm start` (normally auto-detected).
5. Healthcheck path: `/health`.
6. Generate a public domain in Railway Networking.

## Before publishing
- Fill out `public/impressum.html`.
- Replace the placeholder data protection text in `public/datenschutz.html` with the legally appropriate version.
- All purchase/support CTAs currently point to `https://discord.gg/turbodesigns`.

## Structure
- `/` landing page
- `/soundpack` Soundpack Creator product page
- `/weapon-skin` Weapon Skin Creator product page
- `/impressum`
- `/datenschutz`
