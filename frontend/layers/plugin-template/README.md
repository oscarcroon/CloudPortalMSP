# Plugin template (core Tailwind)

En minimal mall för nya plugins/layer-moduler. Kopiera katalogen, byt `example-module` mot ditt `moduleKey` och uppdatera manifestet.

## Vad ingår

- `module.manifest.ts` – exempel på module/permissions/roles/roleDefaults.
- `nuxt.config.ts` – alias, komponent-autoimport och hur du lägger till modulens CSS.
- `pages/example-module/index.vue` – enkel vy som använder core Tailwind-klasser.
- `components/ExampleModuleCard.vue` – modul-lokal komponent med core styling.
- `assets/css/example-module.css` – frivilliga prefixade utilities via `@layer components`.

## Att kopiera mallen

1. Kopiera `layers/plugin-template` till `layers/<module-key>`.
2. Byt ut alla `example-module` till ditt `moduleKey` (kataloger, filer, innehåll).
3. Uppdatera `module.manifest.ts` och lägg till i `layers/plugin-manifests.ts`.
4. (Valfritt) Behåll/justera modulens CSS och se till att `nuxt.config.ts` refererar till rätt fil i `css`.
5. Kör `npm run generate:rbac-types` när manifestet är uppdaterat.
6. Bygg UI med core Tailwind-kontraktet + prefixed utilities (`mod-<module-key>-*`) vid behov.

## CSS-riktlinjer i mallen

- Lägg delade styles i `assets/css/<module-key>.css` med `@layer components`/`@layer utilities`.
- Prefixa allt med `mod-<module-key>-` för att undvika kollisioner.
- Använd `<style scoped>` i komponenter för små justeringar; inga globala resets.


