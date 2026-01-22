# Rensa Gammal Krypterad E-postdata

## Vilken .env-fil ska användas?

**Nuxt-applikationen** (som körs med `pnpm dev`) laddar automatiskt `.env`-filer från `frontend/`-katalogen.

**Drizzle-kommandon** (som `pnpm db:migrate`) använder `dotenv/config` som laddar från den aktuella arbetskatalogen.

### Rekommendation:

1. **För Nuxt-applikationen**: Använd `frontend/.env`
2. **För konsistens**: Kopiera `EMAIL_CRYPTO_KEY` från root `.env` till `frontend/.env` om den saknas

## Steg för att rensa gammal krypterad data:

1. **Sätt EMAIL_CRYPTO_KEY i frontend/.env**:
   ```bash
   # Kopiera från root .env eller skapa ny
   EMAIL_CRYPTO_KEY=din-nyckel-här
   ```

2. **Kör rensningsscriptet**:
   ```bash
   cd frontend
   node scripts/clear-encrypted-email-data.cjs
   ```

3. **Konfigurera e-postinställningar på nytt** i admin-gränssnittet efter rensningen.

## Viktigt:

- Scriptet kommer att visa vilka konfigurationer som kan dekrypteras och vilka som inte kan
- Du måste bekräfta innan något raderas
- Efter rensning måste du konfigurera e-postinställningarna på nytt

