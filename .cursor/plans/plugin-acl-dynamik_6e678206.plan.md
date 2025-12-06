---
name: plugin-acl-dynamik
overview: Ta fram ett dynamiskt flöde för plugins från layers med auto-registrering, aktivering/deaktivering och organisationsspecifika CRUD-grupper som kan kopplas till pluginers roller/ACL.
todos:
  - id: review-current
    content: Kartlägg plugin-registrering och module registry nuläge
    status: in_progress
  - id: enable-toggle
    content: Designa aktivering/deaktivering-flöde & UI-koppling
    status: pending
  - id: org-groups
    content: Designa org-grupp entitet + CRUD API/UI
    status: pending
  - id: group-acl
    content: Utöka module-access med grupp-ACL koppling
    status: pending
  - id: cf-dns-integ
    content: Säkra Cloudflare DNS mot nya ACL-flödet
    status: pending
  - id: migrations-tests
    content: Skriv migrationer och tester
    status: pending
---

## Övergripande designbeslut (rekommenderat)

Innan stegen, några principer jag skulle låsa in:

1. **Skill på “plugin-definition” och “installation”**

   - `module_definitions` (core-tabell): beskriver *vad* pluginet är (key, namn, kategori, vilka scopes det stödjer).
   - `module_installations` (core-tabell): beskriver *var* det är aktivt (tenant/org) och config:

     - `scope_type: 'tenant' | 'organization'`
     - `scope_id` (tenantId eller orgId)
     - `enabled`
     - ev. `settings` (JSONB)
     - `lockedByParent` / `inheritsFromTenant` om du vill ha ärvning.

2. **Standardiserade modul-permissions & roller**

   - Varje plugin definierar i sitt manifest:

     - `permissions` – gärna med mönster som `cloudflare-dns:zone:read`, `cloudflare-dns:zone:write`, `cloudflare-dns:record:delete`.
     - `roles` – “business”-nivå (t.ex. `reader`, `editor`, `admin`) som mappas mot permissions.
   - Core-RBAC vet *inte* om plugin-permissions, utan bara moduleKey + modulroller.

3. **Org-grupper får modulroller, inte rå permissions**

   - Organisationen skapar sina egna grupper (Operations, Web, Infrastructure osv).
   - ACL-tabell: “den här gruppen har den här modulrollen för det här pluginet”.

Det blir mycket mer hanterbart än att kryssa i 30 permission-flaggor per grupp.

---

## Reviderad plan

### 1) Nulägeskartläggning (ingen större ändring, men var tydlig med modell)

**Syfte:** förstå exakt hur Cloudflare-DNS lagret och plugin-registret funkar idag.

- Gå igenom:

  - `frontend/layers/plugin-manifests.ts`
  - `frontend/server/lib/plugin-registry/{types.ts,registry.ts,sync.ts}`
  - `frontend/server/plugins/plugin-registry-sync.ts`
  - Modul-UI:

    - `frontend/app/lib/module-registry.ts`
    - admin-sidor: `frontend/app/pages/admin/modules.vue` + ev. tenant/org modulsidor.
- Kartlägg:

  - Var lagras pluginet idag? Har ni redan en tabell typ `modules` eller liknande?
  - Finns någon flagga för `enabled` per tenant/org?
  - Hur “binds” en användare till modulroller idag (roleDefaults)?

> Rekommendation: rita upp en liten ER-diagram-skiss:

> `module_definitions` → `module_installations` → `module_access / module_group_roles`.

---

### 2) Bas för aktivering/deaktivering (definition vs installation)

**Mål:** skilja på *att koden finns* och *att pluginet är aktiverat i en tenant/org*.

#### Databastabeller (core, ej plugin-specifika)

- `module_definitions`

  - `id`
  - `module_key` (t.ex. `cloudflare-dns`)
  - `name`
  - `description`
  - `category`
  - `available_scopes` (t.ex. `['tenant','organization']`)
  - `default_enabled_for_new_tenants` (bool)
  - `created_at`, `updated_at`

- `module_installations`

  - `id`
  - `module_key` (FK → module_definitions)
  - `scope_type` (`'tenant' | 'organization'`)
  - `scope_id` (tenantId eller orgId)
  - `enabled` (bool)
  - `inherits_from_parent` (bool, om org följer tenant)
  - `settings` (JSONB) – plugin-specifika inställningar
  - `created_at`, `updated_at`

#### API & UI

- **Admin modules-API** (`frontend/server/api/admin/modules*.ts`):

  - Lista alla `module_definitions`.
  - Visa per tenant vilka `module_installations` som finns och dess `enabled`.
  - POST/PUT för att toggla `enabled` och ev. `inherits_from_parent`.

- **Tenant/organization vyer**:

  - Tenant-vy: superadmin/distributör kan aktivera pluginet för tenant (`scope_type='tenant'`).
  - Org-vy: org-admin kan:

    - Se att Cloudflare DNS är “tillgängligt via tenant”.
    - Ev. toggla om org får använda pluginet (egen `module_installation` rad eller flagga som ärver).

> Rek: låt **superadmin “upptäcka och aktivera” pluginet** på tenant-nivå istället för auto-on.

> Det är säkrare och passar din idé om att superadmin hittar pluginet.

---

### 3) Plugin auto-registrering från `/layers`

**Mål:** lägga ett plugin i `/layers/` + manifest ⇒ automatisk registrering i `module_definitions` (ingen core-kodtouch).

#### Manifest-tillägg

I varje `layers/<module-key>/module.manifest.ts`, utöka med t.ex.:

```ts
export default defineModule({
  module: {
    key: 'cloudflare-dns',
    name: 'Cloudflare DNS',
    description: 'Manage Cloudflare DNS zones and records',
    category: 'dns',
    scopes: ['tenant', 'organization'],
    defaultEnabledForNewTenants: false, // eller true för core-moduler
  },
  permissions: [...],
  roles: [...],
  roleDefaults: { ... },
});
```

#### Sync-logik

I `plugin-registry/sync.ts`:

- Läs alla manifest i `/layers/**/module.manifest.ts`.
- Bygg upp en lista av `ModuleDefinitionInput`.
- För varje:

  - **Upsert** in i `module_definitions` (ny eller uppdatera namn/description/category/scopes).
- Flagga ev. moduler i DB som inte längre finns i kod:

  - antingen soft delete `is_obsolete: true`, eller lämna dem orörda (historik).

> Rek: låt `defaultEnabledForNewTenants` endast styra auto-skapande av `module_installations` för *nya* tenants. Befintliga tenants hanteras manuellt av superadmin.

---

### 4) Organisationsspecifika grupper (ny entitet)

**Mål:** org ska kunna skapa egna grupper (Operations, Web, etc.) och återanvända dem i alla plugins.

#### Databastabeller

- `org_groups`

  - `id`
  - `org_id`
  - `name` (t.ex. `Operations`)
  - `slug` (t.ex. `operations`)
  - `description` (valfri)
  - `is_system_default` (bool, ifall du seedar några standardgrupper)
  - `created_by`, `created_at`, `updated_at`

- `org_group_members`

  - `id`
  - `org_group_id`
  - `org_member_id` *eller* `user_id` + `org_id` (beroende på hur du modellat org-medlemmar)
  - `created_at`

> Rek: bind mot din befintliga **org-medlemsmodell** om du har `organization_members` tabell – det blir snyggare.

#### API

Under `frontend/server/api/organizations/[orgId]/groups*.ts`:

- `GET /groups` – lista grupper.
- `POST /groups` – skapa grupp.
- `PUT /groups/[groupId]` – uppdatera namn/description.
- `DELETE /groups/[groupId]` – ta bort grupp (om ej i bruk, eller hantera cascade).
- `POST /groups/[groupId]/members` – lägg till medlem.
- `DELETE /groups/[groupId]/members/[memberId]` – ta bort medlem.

#### UI

Under organisationens settings (t.ex. `frontend/app/pages/organizations/[orgId]/settings/groups.vue`):

- Tabell med grupper + “Ny grupp”.
- Vy för att hantera medlemmar (multi-select av org-medlemmar).

---

### 5) Knyt grupper till modul-ACL via modulroller

**Mål:** org-grupper ska kunna ges modulroller (som definieras i plugin-manifestet) för ett plugin.

#### Databastabell för ACL

I stället för rå CRUD per permission rekommenderar jag:

- `module_group_roles`

  - `id`
  - `org_id`
  - `module_key`
  - `org_group_id`
  - `module_role_key` (t.ex. `editor`, `admin` – kommer från manifest.roles)
  - `created_at`, `created_by`

> Om du vill ha mer avancerat i framtiden kan du senare lägga till `effect` (`'allow'|'deny'`) eller `resource_scope` men börja enkelt.

#### Module-access logik

I `frontend/server/lib/modules/module-access.ts`:

- Utöka dina types så att `ModuleAccess` kan modellera:
  ```ts
  type EffectiveModuleAccess = {
    moduleKey: string;
    roles: string[];        // modulroller
    permissions: string[];  // flattar ut roller → permissions
  };
  ```

- När du bygger `userContext` för en viss org:

  1. Kolla **org-medlemskap** → org-roller → `roleDefaults` → modulroller (som idag).
  2. Kolla **org-grupper** som användaren är medlem i:

     - Slå i `module_group_roles` där:

       - `org_id = currentOrg`
       - `module_key = 'cloudflare-dns'` (eller generiskt)
       - `org_group_id` ∈ (användarens grupp-id:n)
     - Lägg till de modulrollerna.

  1. Filtrera bort access om:

     - pluginet inte är installerat/`enabled` i `module_installations`.

  1. Returnera slutligt `EffectiveModuleAccess` som frontenden och server-guards använder.

#### API för att sätta modulroller per grupp

- Under t.ex. `frontend/server/api/organizations/[orgId]/modules/[moduleKey]/acl/groups.ts`:

  - `GET` – lista alla grupper + deras modulroller.
  - `PUT` – spara en matris av `{ orgGroupId, moduleRoleKeys[] }`.

#### UI

- På org-nivå modulinställningar (t.ex. `frontend/app/pages/organizations/[orgId]/modules/[moduleKey].vue`):

  - Visa matrise-vy:

    - Rader: org-grupper
    - Kolumner: modulroller (från manifest)
    - Checkboxar eller radio (multi-role eller single-role per grupp).

> Rek: håll UI per modul generiskt – bygg en generell “Module ACL editor” komponent som tar `moduleKey`, `roles`, `groups` som input.

---

### 6) Anpassa Cloudflare DNS-lagret

**Mål:** Cloudflare-DNS ska vara “poster child” för hur alla framtida plugins ska bete sig.

#### Manifest

- Se till att `layers/cloudflare-dns/module.manifest.ts`:

  - Har standardiserade CRUD-permissions, typ:

    - `cloudflare-dns:zone:read|write`
    - `cloudflare-dns:record:read|create|update|delete`
  - Definierar modulroller som:

    - `reader` → read-permissions
    - `editor` → read+write records
    - `admin` → allt (inkl. zone-manage, settings)

#### DB/Prefix

- Plugin-specifika tabeller ska använda prefix `cloudflare_dns_*` (som du önskar).

  - T.ex. `cloudflare_dns_credentials`, `cloudflare_dns_audit`, etc.

#### API-routes

- Samtliga server-routes under `frontend/layers/cloudflare-dns/server/api/...` (eller var de nu ligger) ska börja med en guard/helper:
  ```ts
  const access = await requireModulePermission(event, 'cloudflare-dns', 'cloudflare-dns:record:write');
  ```


eller motsvarande helper baserad på modulroll:

  ```ts
  const access = await requireModuleRole(event, 'cloudflare-dns', ['editor', 'admin']);
  ```

- `requireModulePermission` / `requireModuleRole` bör:

  - Använda `module-access.ts` för att läsa `EffectiveModuleAccess` för aktuell user/org.
  - Kasta 403 om man saknar behörighet.

#### UI

- Sidorna i `layers/cloudflare-dns` (Vue/Nuxt) ska använda samma generiska hook, t.ex.:
  ```ts
  const { hasModuleRole, hasModulePermission } = useModuleAccess('cloudflare-dns');
  
  const canEdit = computed(() =>
    hasModuleRole('editor') || hasModuleRole('admin')
  );
  ```

- Dölja/disable:a knappar, länkar, formulärfält baserat på access.

---

### 7) Migrationer, seeds och tester

**Mål:** få en konsekvent datamodell + regression-skydd.

#### Drizzle-migrationer

- Skapa migrationer för:

  - `module_definitions`
  - `module_installations`
  - `org_groups`
  - `org_group_members`
  - `module_group_roles`
- För Cloudflare DNS:

  - Säkerställ att befintliga tabeller följer prefix `cloudflare_dns_*` – ev. migrera/rename.

#### Seeds

- Optionellt:

  - Seed några system-grupper på org-nivå (t.ex. `Operations`, `Developers`) för demo/skyddad test-org.
  - Seed modul-definitioner vid första körningen via plugin-sync (dvs. första syncen).

#### Tester

- Lägg till tester (unit + integration) för:

  1. **Plugin-registrering**

     - Ny manifest i `/layers/cloudflare-dns` ⇒ uppdaterar `module_definitions`.

  1. **Aktivering**

     - Superadmin aktiverar Cloudflare DNS för en tenant ⇒ `module_installations` rad skapas.

  1. **Org-grupp + ACL**

     - Skapa org-grupp `Operations`.
     - Koppla gruppen till modulrollen `editor` för `cloudflare-dns`.
     - Lägg användare i `Operations`.
     - Verifiera att:

       - `module-access` ger `editor` för Cloudflare.
       - API-call som kräver `editor` går igenom.

  1. **Deaktivering**

     - Sätt `enabled=false` i `module_installations` ⇒ API/UI blockeras.