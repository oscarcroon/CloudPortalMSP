# Plugin guidelines (layered modules)

- Varje plugin har en unik module key, t.ex. `windows-dns`.
- Alla plugin-tabeller ska prefixas med modulens key (ex. `windows_dns_*`).
- Core-RBAC i `constants/rbac.ts` innehåller enbart app-roller och core-permissions; modul-specifika permissions ska alltid komma från plugin-manifest + DB-sync.
- Skapa ett manifest i `layers/<module-key>/module.manifest.ts` som definierar:
  - `module` (key, name, description, category)
  - `permissions` (lista av permission keys)
  - `roles` (key, label, permissions, sortOrder)
  - `roleDefaults` (app-roll → modulroll)
- Lägg till manifestet i `layers/plugin-manifests.ts`.
- Kör `npm run generate:rbac-types` för att uppdatera typer i `app/generated/rbac-types.ts`.
- Synkronisering till DB sker via `server/lib/plugin-registry/sync.ts` (körs vid Nitro-start).
- Modulåtkomst hämtas via `server/lib/modules/module-access.ts`.
- Fine-grained ACL-mönstret finns i `server/lib/acl/fine-grained.ts`.
- Exempelplugin: Windows DNS med tabellprefix `windows_dns_` och API under `/api/dns/windows/...`.



