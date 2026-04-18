# Matecha Landing

Landing statique + canal WhatsApp waitlist.

## Développement local

```
npm install
cp .env.example .env.local  # remplir les clés
npm run build:data          # génère savings-summary.json depuis SuppliersDB/
npx vercel dev              # lance front + functions sur :3000
```

## Variables d'environnement (Vercel)

| Clé | Usage |
|-----|-------|
| `SUPABASE_URL` | Projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Insertion leads (server-only) |
| `CANAL_WHATSAPP_URL` | Lien public du Canal (optionnel, sinon CTA masqué) |
| `LAUNCH_OFFER_CODE_PREFIX` | Préfixe des codes (défaut: MATECHA) |

## Tests

```
npm test
```

## Rafraîchir les données d'économies

```
npm run build:data
git commit -am "data: refresh savings summary"
```

## Conformité CNDP

Voir `public/politique-confidentialite.html`. Les leads sont conservés 36 mois max. Demandes de suppression : contact@matecha.ma.
