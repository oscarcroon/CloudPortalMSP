# Tailwind-kontrakt för plugins

Den här sidan beskriver vilka Tailwind-tokens och mönster som core garanterar för plugins/layers, samt vilka regler som gäller för egna styles.

## Public API (core)

- Typografi: Inter, `text-sm|base|lg`, `font-medium|semibold`, `leading-5|6`, `tracking-tight`.
- Ytor: `rounded-lg|xl|2xl`, `shadow-sm|md|card`, `border`, `divide-y divide-slate-100 dark:divide-slate-800`.
- Layout: `flex|grid`, `gap-2|3|4|6`, `p-4|5|6`, `max-w-3xl|5xl`, `items-center`, `justify-between`.
- Basfärger: `bg-white`, `dark:bg-slate-900`, `border-slate-200|300`, `dark:border-slate-700`, brand via `text-brand`, `bg-brand/10`, `text-brand/80`.
- Interaktion: `hover:-translate-y-[1px]`, `transition`, `focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60`.
- Statusfärger: standard Tailwind (`text-green-600`, `text-red-600`, `bg-yellow-50` etc.) + brand.

## Do / Don’t

- ✅ Använd core-komponenter och ovanstående klassmönster före egna lösningar.
- ✅ Håll styling nära komponenten (`<style scoped>`) och dela endast små utilities.
- ✅ Prefixa modul-globala klasser med `mod-<module-key>-` i `@layer components`/`@layer utilities`.
- ❌ Ingen global reset eller ändring av core-tema.
- ❌ Skapa inte generiska klassnamn som `.card`, `.btn`, `.title` etc. (reserverade för core).
- ❌ Ändra inte `tailwind.config.ts` från ett plugin.

## Egna styles (scoped eller prefixade)

- Lägg modul-globala utilities i `layers/<module-key>/assets/css/<module-key>.css` och importera i modulens `nuxt.config.ts` via `css: ['./assets/css/<module-key>.css']`.
- Använd `@layer components`/`@layer utilities` och prefixa alla klasser med `mod-<module-key>-`.
- Behåll justeringar små: layout/spacing/statusmarkeringar, inte ett nytt designsystem.

## Kodgranskningstest för CSS-prefix

- Scriptet `npm run lint:plugin-css` varnar om plugin-CSS innehåller otillåtna generiska klassnamn (t.ex. `.card`, `.btn`, `.title`).
- Använd scriptet lokalt innan PR för att undvika kollisioner med core-styles.


