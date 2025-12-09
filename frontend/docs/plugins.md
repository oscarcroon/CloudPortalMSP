# Plugin guidelines (layered modules)

## Grundprinciper

- Varje plugin har en unik `moduleKey`, t.ex. `cloudflare-dns`.
- Alla plugin-tabeller i databasen ska prefixas med modulens key, t.ex. `windows_dns_*`.
- Core-RBAC i `constants/rbac.ts` innehåller **endast** app-roller och core-permissions.
  - Modul-specifika permissions ska **alltid** definieras i pluginets manifest och synkas till DB.
- Pluginet ansvarar för sin domänlogik och UI-komponenter, men ska i första hand använda **core-Tailwind-designsystemet** och core-komponenter.
- Se `docs/ui/tailwind-contract.md` för detaljkontrakt (public API-klasser, do/don’t).

## RBAC & manifest

- Skapa ett manifest i `layers/<module-key>/module.manifest.ts` som definierar:
  - `module`: `{ key, name, description, category }`
  - `permissions`: lista av permission keys (`'<moduleKey>:<action>'`)
  - `roles`: `{ key, label, permissions, sortOrder }[]`
  - `roleDefaults`: mapping app-roll → modul-roll(ar)
- Lägg till manifestet i `layers/plugin-manifests.ts`.
- Kör `npm run generate:rbac-types` för att uppdatera typer i `app/generated/rbac-types.ts`.
- Synkronisering till DB sker via `server/lib/plugin-registry/sync.ts` (körs vid Nitro-start).
- Modulåtkomst hämtas via `server/lib/modules/module-access.ts`.
- Fine-grained ACL-mönster finns i `server/lib/acl/fine-grained.ts`.
- Exempelplugin: Windows DNS med tabellprefix `windows_dns_*` och API under `/api/dns/windows/...`.

## UI & Tailwind – core först

- Använd core-Tailwind-klasser och etablerade mönster för layouter och kort (t.ex. `bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-card p-6 flex gap-4`).
- Ingen global reset eller override av core-tema (låna alltid från core-färger/spacing/typografi).
- Håll styling nära komponenten: `<style scoped>` först; dela endast små, modul-specifika utilities.

## Core Tailwind-kontrakt (garanterat av core)

- Basfärger: `bg-white`, `dark:bg-slate-900`, `border-slate-200|300` och `dark:border-slate-700`, brand via `text-brand`, `bg-brand/10`, `text-brand/80`.
- Typografi: Inter som default, `text-sm|base|lg`, `font-medium|semibold`, `tracking-tight`, `leading-5|6`.
- Ytor: `rounded-lg|xl|2xl`, `shadow-sm|md|card`, `border`, `divide-y divide-slate-100 dark:divide-slate-800`.
- Layout: `flex|grid`, `gap-2|3|4|6`, `p-4|5|6`, `max-w-3xl|5xl`, `items-center`, `justify-between`.
- Interaktion: `hover:-translate-y-[1px]`, `transition`, `focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60`.
- Statusfärger: Tailwind standard (`text-green-600`, `text-red-600`, `bg-yellow-50` etc.) + brand.

## Eget CSS (valfritt)

- Globala modul-klasser ska läggas i `layers/<module-key>/assets/css/<module-key>.css` och importeras i modulens `nuxt.config.ts` via `css: ['./assets/css/<module-key>.css']`.
- Använd `@layer components` eller `@layer utilities` och prefixa allt med `mod-<module-key>-`.
- Exempel:
  ```css
  @layer components {
    .mod-example-module-panel {
      @apply border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-900;
    }
  }
  ```
- Ingen användning av generiska klassnamn som `.card`, `.btn`, `.title` – reserverat för core.
- Behåll justeringar små: layout, spacing, små färg- eller statusmarkeringar. Skapa inte ett eget designsystem.
- Kör gärna `npm run lint:plugin-css` för att fånga otillåtna klassnamn innan PR.

## Namnkonventioner för CSS

- Globala klasser (i `@layer components/@layer utilities`) ska:
  - Prefixas med `mod-<module-key>-`, t.ex. `.mod-cloudflare-dns-record-row`.
  - Inte krocka med core-klasser eller generiska namn.
- Komponentlokal CSS:
  - Använd `<style scoped>` i Vue/Nuxt-komponenter när det går.
  - Håll stil-regler små och semantiska (layout + små justeringar), inte ett eget designsystem.

## Plugin-boilerplate (rekommenderad startpunkt)

- Utgå från `layers/plugin-template`:
  - `module.manifest.ts` – kopiera och justera `moduleKey`, permissions och roller.
  - `pages/<module-key>/index.vue` – exempelvy som använder core-komponenter och core-Tailwind.
  - `components/<ModuleKey>ExampleCard.vue` – exempel på modul-lokal komponent.
  - `assets/css/<module-key>.css` – frivilliga modul-styles med `@layer components` och `mod-<module-key>-*` prefix.
- Följ checklistan:
  1. Välj `moduleKey` och skapa databas-tabeller med prefix `windows_dns_*`.
  2. Kör `npm run scaffold:plugin <module-key>` (kopierar template + byter namn).
  3. Uppdatera `module.manifest.ts` och lägg till i `layers/plugin-manifests.ts`.
  4. (Valfritt) Lägg till modulens CSS-fil i `nuxt.config.ts` → `css: ['./assets/css/<module-key>.css']`.
  5. Kör `npm run lint:plugin-css` för att säkra prefix-regler.
  6. Kör `npm run generate:rbac-types`.
  7. Implementera API under en modul-scope route (t.ex. `/api/dns/windows/...`).
  8. Bygg UI med core-komponenter + Tailwind-kontraktet.
