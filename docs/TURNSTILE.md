# Cloudflare Turnstile (CAPTCHA)

## Vad ar Turnstile?

Cloudflare Turnstile ar Cloudflares CAPTCHA-alternativ. Till skillnad fran traditionell CAPTCHA (som Google reCAPTCHA) behover anvandaren normalt inte losa nagot pussel — Turnstile koer i bakgrunden och verifierar att besokaren ar en riktig manniska genom att analysera webblaesarbeteende, utan att samla in persondata.

Turnstile erbjuder tre widget-typer:

| Typ | Beteende |
|-----|----------|
| **Managed** (rekommenderad) | Cloudflare valjer automatiskt — oftast osynlig, ibland en enkel checkbox |
| **Non-interactive** | Alltid osynlig |
| **Invisible** | Helt dold, inget UI alls |

Vi anvaender **Managed** saa att Cloudflare kan valja laemplig utmaningsnivaa baserat paa riskbedomning.

## Varfoer Turnstile?

Portalen ar exponerad mot internet och inloggningssidan ar ett attraktivt maal foer:

- **Brute force** — automatiserade inloggningsfoesoek med laesenordslistor
- **Credential stuffing** — stulna inloggningsuppgifter fran andra tjoenster
- **Password spraying** — ett vanligt loesenord testas mot manga konton
- **Spam-abuse** — massutskick av aterstallningsmejl via forgot-password

Rate limiting (5 foesoek/15 min per e-post, 20/15 min per IP) stoppar naiva attacker, men sofistikerade botar roterar IP-adresser och kan komma foerbi. Turnstile laegger till ett lager som kraever en riktig webblaesearmiljoe — naaagot som headless scripts och botar har svaart att fejka.

### Skyddsmodell

```
Inloggningsfloede:

  Anvandare fyller i e-post
          |
          v
  Anvandare fyller i loesenord
          |
          v
  +-------------------+
  | Turnstile-widget   |  <-- Verifierar att det aer en riktig webblaeesare
  | (koers automatiskt)|
  +-------------------+
          |
          v  token skickas med i POST-body
  +-------------------+
  | Rate limiting      |  <-- 5 foesoek/email, 20/IP per 15 min
  +-------------------+
          |
          v
  +-------------------+
  | Turnstile server   |  <-- Server verifierar token mot Cloudflare API
  | verification       |
  +-------------------+
          |
          v
  +-------------------+
  | Loesenordskontroll |  <-- bcrypt-verifiering
  +-------------------+
          |
          v
  +-------------------+
  | MFA (om aktiverat) |
  +-------------------+
          |
          v
     Session skapas
```

## Saa haer funkar det tekniskt

### Klient-sidan

1. `<NuxtTurnstile>` renderas paa login (password-steget) och forgot-password
2. Turnstile-widgeten koer automatiskt i bakgrunden och genererar en engaangstoken
3. Token lagras i `turnstileToken` ref via `v-model`
4. Vid submit skickas token med i request body som `turnstileToken`
5. Vid fel (t.ex. ogiltigt loesenord) aterstalls widgeten med `turnstileRef.value?.reset()` saa att en ny token genereras

### Server-sidan

1. API-routen laeeser `turnstileToken` fraan request body
2. `requireTurnstileToken(event, token)` anropas
3. Token skickas till `https://challenges.cloudflare.com/turnstile/v0/siteverify` med secret key + klient-IP
4. Om verifieringen lyckas: fortsaett med login
5. Om den misslyckas: returnera 403

### Floede foer MFA-anvaendare

Turnstile verifieras **bara paa password-steget**, inte paa MFA-steget. Anvandaren har redan passerat Turnstile naer de matar in loesenordet — att kraeva det igen paa MFA-steget vore onoedigt.

```
Password-steg: Turnstile ✓ → loesenord verifierat → MFA kraver
MFA-steg:      Inget Turnstile → TOTP/backup-kod verifieras → inloggad
```

## Filer

| Fil | Roll |
|-----|------|
| `portal/server/utils/turnstile.ts` | `requireTurnstileToken()` — server-side verifiering mot Cloudflare |
| `portal/server/api/auth/login.post.ts` | Anropar `requireTurnstileToken()` efter rate limit, foere DB-uppslag |
| `portal/server/api/auth/password/forgot.post.ts` | Anropar `requireTurnstileToken()` efter body-parsning |
| `portal/app/pages/login.vue` | `<NuxtTurnstile>` widget paa password-steget |
| `portal/app/pages/forgot-password.vue` | `<NuxtTurnstile>` widget foere submit-knappen |
| `portal/nuxt.config.ts` | Modul-registrering + `turnstile.siteKey` + `runtimeConfig.turnstile.secretKey` |

## Miljovariabler

```env
# Public — skickas till webblaesaren, används av Turnstile-widgeten
NUXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAA...

# Privat — används enbart server-side foer att verifiera token
NUXT_TURNSTILE_SECRET_KEY=0x4AAAAAA...
```

Baada haemtas fraan Cloudflare Turnstile-dashboarden.

## Konfigurationsguide (steg foer steg)

### 1. Skapa en Turnstile-site i Cloudflare

1. Logga in paa [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Gaa till **Turnstile** i vaenstermenyn
3. Klicka **Add site**
4. Vaelj **Managed** widget-typ
5. Under **Domain Management**: **staeng av hostname-validering** (eller laegg till alla domaener manuellt)
   - Detta aer viktigt foer att widgeten ska fungera paa bade huvuddomaenen och alla organisationers custom domains (t.ex. `org.portal.coreit.cloud`)
6. Spara

### 2. Kopiera nycklar

Fraan Turnstile-dashboarden, kopiera:
- **Site Key** → `NUXT_PUBLIC_TURNSTILE_SITE_KEY`
- **Secret Key** → `NUXT_TURNSTILE_SECRET_KEY`

### 3. Konfigurera miljovariabler

Laegg till i din `.env`:

```env
NUXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAAxxxxxxxxxxxxxxxx
NUXT_TURNSTILE_SECRET_KEY=0x4AAAAAAAxxxxxxxxxxxxxxxx
```

### 4. Starta om servern

```bash
cd portal && npm run dev
```

Turnstile-widgeten dyker nu upp paa login- och forgot-password-sidorna.

## Custom domains

Turnstile site key aer bundet till specifika domaener i Cloudflare. Foer att stoed alla organisationers custom domains finns tvaa alternativ:

| Alternativ | Foer | Nackdel |
|------------|------|---------|
| **Staeng av hostname-validering** (rekommenderat) | Enklast, fungerar paa alla domaener automatiskt | Naagot laegre saekerhetsnivaaa (naaagon annan kan aateranvaenda din site key paa sin sida) |
| **Laegg till alla domaener manuellt** | Straengare kontroll | Kraever manuell uppdatering naer nya domaener laeggs till |

**Rekommendation:** Staeng av hostname-validering. Server-side verifieringen med secret key saekerstaller aendaa att token aer giltig — naaagon som aateranvaender din site key faar inget vaerde av det.

## Graceful degradation

| Scenario | Beteende |
|----------|----------|
| Inga env-vars (lokal dev) | Widget renderas inte, server hoppar oever verifiering. Login fungerar som vanligt |
| Widget laddar normalt | Token fylls i automatiskt, submit fungerar |
| Widget laddar inte (naetverksfel) | `turnstileToken` foerblir tom straeng. Server returnerar 400 om secret key aer konfigurerad |
| Token ogiltig/utgaangen | Server returnerar 403, klient visar felmeddelande + aterstaller widget |
| Cloudflare siteverify nere | **Produktion:** 503 (fail-closed). **Dev:** fail-open med console.warn |
| MFA-steg | Turnstile hoppas oever (anvandaren passerade redan i password-steget) |

### Foer utvecklare i lokal miljoee

**Du behover inte goera naaagot.** Utan `NUXT_TURNSTILE_SECRET_KEY` i `.env` hoppas all Turnstile-verifiering oever. Widgeten renderas inte heller utan site key. Login fungerar exakt som foerut.

## Testning

### Med Cloudflares testnycklar

Cloudflare tillhandahaaller speciella testnycklar:

| Typ | Site Key | Secret Key |
|-----|----------|------------|
| Alltid lyckas | `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` |
| Alltid misslyckas | `2x00000000000000000000AB` | `2x0000000000000000000000000000000AB` |
| Tvingas interaktiv | `3x00000000000000000000FF` | (valfri giltigt secret) |

Saett testnycklar i `.env`:

```env
NUXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
NUXT_TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

### Testscenarier

1. **Utan env-vars:** Starta dev-server → login fungerar utan widget (bakaat-kompatibelt)
2. **Med "alltid lyckas"-nycklar:** Login → e-post → loesenord → widget syns → submit → login lyckas
3. **MFA-floede:** Passera widget → MFA-steg → submit utan ny widget → inloggad
4. **Forgot-password:** Widget syns → submit → success
5. **Med "alltid misslyckas"-nycklar:** Verifiera att server returnerar 403 och klient visar felmeddelande
6. **Custom domain:** Testa via slug-host (t.ex. `org.portal.coreit.cloud`) — widget ska fungera

## Felsoekning

### Widget syns inte

- Kontrollera att `NUXT_PUBLIC_TURNSTILE_SITE_KEY` aer satt
- Kontrollera webblaeesarens naetverk-flik foer blockerade requests till `challenges.cloudflare.com`
- Content Security Policy (CSP) kan blockera Turnstile — laegg till `challenges.cloudflare.com` i `script-src` och `frame-src`

### "Turnstile verification failed" (403)

- Token kan ha gaatt ut (giltighet ~300 sekunder) — widgeten aterstalls automatiskt vid fel
- Felaktig secret key — kontrollera att `NUXT_TURNSTILE_SECRET_KEY` matchar site key
- Token aateranvaend — varje token kan bara verifieras en gaang

### "Turnstile token is required" (400)

- Klienten skickade ingen token — kontrollera att `turnstileToken` ref har ett vaerde foere submit
- Widget kanske inte laddades korrekt — kontrollera webblaeesarkonsolen
