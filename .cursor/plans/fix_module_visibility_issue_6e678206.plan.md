---
name: fix_module_visibility_issue
overview: Rätta modulernas (layers) visibilitet så att global registrering, tenant- och org-policy samt UI (dashboard, navbar, favoriter) följer samma kedja.
todos:
  - id: model-semantics
    content: Rensa upp semantik för modules.enabled, tenantModulePolicies och organizationModulePolicies (gömd vs utgråad vs ärvd).
    status: completed
  - id: backend-policy
    content: Uppdatera modulePolicy (getTenantModulesStatus/getOrganizationModulesStatus) så de beräknar global/tenant/org/effective enabled korrekt.
    status: completed
    dependencies:
      - model-semantics
  - id: backend-api
    content: Justera admin/tenant/org API-endpoints så de speglar nya policyfält och rätt behörigheter.
    status: completed
    dependencies:
      - backend-policy
  - id: backend-access
    content: Koppla getModuleAccessForUser och plugin-endpoints till nya effectiveEnabled-regler.
    status: completed
    dependencies:
      - backend-policy
  - id: frontend-composables-ui
    content: Anpassa useModules/useAvailableModules, dashboard, navbar och inställningssidor till den nya modulstatusmodellen.
    status: completed
    dependencies:
      - backend-api
  - id: middleware-routes
    content: Säkerställ att modul-middleware blockerar routes när moduler inte är effectiveEnabled.
    status: completed
    dependencies:
      - frontend-composables-ui
  - id: tests-visibility
    content: Lägg till tester som verifierar kedjan Global → Tenant → Org → UI/access.
    status: completed
    dependencies:
      - backend-access
      - frontend-composables-ui
---

## Plan – Dynamiska plugins/layers + ACL för `cloudflare-dns`

### Målbild

- Alla plugins/layers ligger under `/layers/<layerKey>`.
- Varje plugin registrerar sig själv via en `layer.manifest.ts`.
- Inga nya plugins kräver ändringar i `backend/src/constants/rbac.ts` eller `frontend/app/constants/rbac.ts`.
- Plugins kan aktiveras per **tenant** och per **organisation**.
- Varje organisation har egna grupper (Operations, Web, etc.) som används för ACL/CRUD per plugin.
- `cloudflare-dns` blir referens-pluginet som visar hur man ska bygga nya plugins.

---

## 1. Datamodell: registry, aktivering & ACL

### 1.1. Skapa tabeller för plugin registry

**Mål:** Central tabell för alla lager/plugins + koppling per tenant/org.

**Åtgärder (drizzle / migrations):**

Skapa tabell `layers`:

- `id` – PK
- `key` – `varchar`, unik (ex. `cloudflare_dns`)
- `display_name` – `varchar`
- `description` – `text` (nullable)
- `version` – `varchar`
- `type` – `varchar` (`plugin` / `core` / etc.)
- `scopes` – `jsonb` (t.ex. `["tenant","organization"]`)
- `metadata` – `jsonb` (extra info från manifestet)

Skapa tabell `tenant_layers`:

- `id` – PK
- `tenant_id` – FK → tenants
- `layer_id` – FK → layers
- `enabled` – bool (default `false`)
- `settings` – `jsonb` (tenant-specifika settings, t.ex. default API-konto)

Skapa tabell `organization_layers`:

- `id` – PK
- `organization_id` – FK → organizations
- `layer_id` – FK → layers
- `enabled` – bool (default `false`)
- `settings` – `jsonb` (org-specifika settings, t.ex. API token, zone filters)

**Acceptance criteria:**

- Drizzle schema finns för alla tabeller.
- Migrations körs utan fel och tabellerna syns i databasen.

---

### 1.2. Skapa tabeller för org-grupper

**Mål:** Varje organisation kan ha egna grupper som används i ACL (Operations, Web, etc.).

**Åtgärder:**

Skapa tabell `organization_groups`:

- `id` – PK
- `organization_id` – FK → organizations
- `name` – `varchar` (ex. “Operations”)
- `slug` – `varchar` (ex. `operations`)
- `description` – `text` (nullable)
- `is_system` – bool (default `false`) – markerar systemskapade grupper (t.ex. “Owners”).

Skapa tabell `organization_group_members`:

- `id` – PK
- `organization_group_id` – FK → organization_groups
- `user_id` – FK → users

**Acceptance criteria:**

- Du kan skapa grupper per organisation.
- Du kan lägga till/ta bort medlemmar i grupperna.

---

### 1.3. Skapa tabell för org-plugin-ACL (CRUD)

**Mål:** Koppla plugin-actions (create/read/update/delete) till org-grupper.

**Åtgärder:**

Skapa tabell `organization_layer_acl`:

- `id` – PK
- `organization_id` – FK → organizations
- `layer_id` – FK → layers
- `action` – `varchar`

  - innehåller t.ex. `'create' | 'read' | 'update' | 'delete' | 'manage'`
- `group_ids` – `jsonb` – array av `organization_groups.id` som har rätt till actionen

(Om du vill ha tenant-nivå ACL också, skapa motsvarande `tenant_layer_acl`.)

**Acceptance criteria:**

- ACL-tabellen kan lagra för en org:

  - vilka grupper som får `create/read/update/delete` på ett visst layer.

---

## 2. Layer manifest & core-helpers

### 2.1. Manifest-typ & `defineLayer`

**Mål:** Standardiserad typ för alla plugin-manifest och en helper för typ-säkerhet.

**Åtgärder:**

Skapa t.ex. `backend/src/layers/types.ts`:

```ts
export type LayerScope = 'tenant' | 'organization' | 'global'

export interface LayerModuleDefinition {
  moduleKey: string
  route: string
  icon?: string
  defaultVisibleOnDashboard?: boolean
}

export interface LayerAclTemplate {
  [action: string]: string[] // t.ex. { create: ['Owners'], read: ['Owners', 'Operations'] }
}

export interface LayerManifest {
  key: string
  type: 'plugin' | 'core'
  displayName: string
  description?: string
  version: string
  scopes: LayerScope[]
  modules: LayerModuleDefinition[]
  capabilities: {
    actions: string[] // t.ex. ['create','read','update','delete']
  }
  migrations?: {
    namespace: string // t.ex. 'cloudflare_dns'
    path: string      // t.ex. 'drizzle/migrations'
  }
  defaults?: {
    orgAclTemplate?: LayerAclTemplate
    tenantAclTemplate?: LayerAclTemplate
  }
  metadata?: Record<string, unknown>
}
```

Skapa `backend/src/layers/define-layer.ts`:

```ts
import type { LayerManifest } from './types'

export function defineLayer<T extends LayerManifest>(manifest: T): T {
  return manifest
}
```

**Acceptance criteria:**

- Alla framtida plugins kan importera `defineLayer` och få typstöd.

---

### 2.2. Manifest för `/layers/cloudflare-dns/layer.manifest.ts`

**Mål:** Göra `cloudflare-dns` till referens-plugin.

**Åtgärder:**

Skapa/uppdatera `layers/cloudflare-dns/layer.manifest.ts`:

```ts
import { defineLayer } from '@/layers/define-layer'

export default defineLayer({
  key: 'cloudflare_dns',
  type: 'plugin',
  displayName: 'Cloudflare DNS',
  description: 'Manage DNS zones and records via Cloudflare',
  version: '1.0.0',

  scopes: ['tenant', 'organization'],

  modules: [
    {
      moduleKey: 'cloudflare_dns.zones',
      route: '/dns/cloudflare/zones',
      icon: 'IconCloudflare',
      defaultVisibleOnDashboard: true,
    },
    {
      moduleKey: 'cloudflare_dns.records',
      route: '/dns/cloudflare/records',
      icon: 'IconCloudflare',
      defaultVisibleOnDashboard: false,
    },
  ],

  capabilities: {
    actions: ['create', 'read', 'update', 'delete'],
  },

  migrations: {
    namespace: 'cloudflare_dns',
    path: 'backend/drizzle/migrations', // anpassa till ditt faktiska path
  },

  defaults: {
    orgAclTemplate: {
      create: ['Owners'],
      read: ['Owners', 'Operations', 'Web'],
      update: ['Owners', 'Operations'],
      delete: ['Owners'],
    },
    tenantAclTemplate: {
      create: ['TenantOwners'],
      read: ['TenantOwners'],
      update: ['TenantOwners'],
      delete: ['TenantOwners'],
    },
  },
})
```

**Acceptance criteria:**

- Manifestet kompilerar.
- Alla tabellnamn och namespaces för Cloudflare DNS följer prefixet `cloudflare_dns_*` i schema/migrations.

---

## 3. Loader: Scanna `/layers`, importera manifest & registrera i DB

### 3.1. Implementera layer-loader på backend

**Mål:** Vid backend-start:

- hitta alla `layer.manifest.ts`
- validera dem
- upserta in i `layers`-tabellen

**Åtgärder:**

Skapa t.ex. `backend/src/layers/loader.ts`:

- Funktion `loadLayerManifests()`:

  - Scan directory `/layers/*/layer.manifest.(ts|js)` (Node fs + dynamic import).
  - Importera varje manifest (default export).
  - Validera mot `LayerManifest` med t.ex. Zod eller egen validering.

- Funktion `syncLayersToDatabase(manifests: LayerManifest[])`:

  - För varje manifest:

    - hitta `layers.key = manifest.key`
    - om finns: uppdatera `display_name`, `description`, `version`, `type`, `scopes`, `metadata`
    - annars: insert.

Anropa detta i din backend bootstrap (t.ex. `server.ts` eller `index.ts`) **innan** servern börjar lyssna.

**Acceptance criteria:**

- Om du lägger till ett nytt plugin med manifest dyker det automatiskt upp som rad i `layers`.
- Version eller displayName uppdateras om du ändrar manifestet.

---

## 4. ACL/effective permissions för plugins

### 4.1. Resolvning av plugin-CRUD via grupper

**Mål:** `userContext` får plugin-specifika permissions baserat på org-grupper & ACL.

**Åtgärder:**

I din auth-/context-bygge (t.ex. `backend/src/auth/buildUserContext.ts`):

1. Hämta aktiv organisation (`activeOrganizationId`) från session/request.

2. Hämta alla `organization_groups` där:

   - `organization_id = activeOrganizationId`
   - JOIN `organization_group_members` där `user_id = currentUserId`.

3. Lista `userGroupIds`.

4. Hämta alla `organization_layer_acl` för `organization_id = activeOrganizationId`.

5. För varje ACL-rad:

   - `layer_id`, `action`, `group_ids`.
   - Om `group_ids` ∩ `userGroupIds` ≠ ∅ → användaren har den actionen på det lagret.

6. Mappa detta till permission-strings i `userContext.permissions`, t.ex:

   - `'layer:cloudflare_dns:create'`
   - `'layer:cloudflare_dns:read'`
   - osv.

Där `cloudflare_dns` kommer från join `layers.id = layer_id` (`layers.key`).

7. Optionellt: mappa vidare till modul-permissions om du vill mer granulärt:

   - `'cloudflare_dns.zones:read'`
   - `'cloudflare_dns.records:update'`

(Men core-idén är att plugin ACL styr vad som hamnar i `userContext.permissions`.)

**Acceptance criteria:**

- När användaren läggs till/ tas bort från en org-grupp uppdateras deras plugin-permissions vid nästa inlogg/refresh.
- Du kan använda `can('layer:cloudflare_dns:read')` i routes/services.

---

## 5. API & UI för att aktivera plugins

### 5.1. Global (superadmin) – Plugin registry

**Mål:** Superadmin ska se alla registrerade layers/plugins.

**Åtgärder:**

Backend:

- Skapa endpoint: `GET /api/admin/layers`

  - returnerar listan från `layers` + ev. metadata (antal tenants/orgs där pluginet är aktivt).

Frontend:

- Skapa sida t.ex. `frontend/app/pages/admin/layers/index.vue`:

  - Tabell med: key, displayName, version, scopes, type.
  - Ev. flagga “Available for tenants” om du vill ha global av/på (kan mappas till flagga i `layers.metadata`).

**Acceptance criteria:**

- Superadmin-sidan visar alla plugins automatiskt efter att manifest loader körts.

---

### 5.2. Tenant-nivå – aktivera plugin för tenant

**Mål:** Tenant-admin ska kunna aktivera/deaktivera plugins för sin tenant.

**Åtgärder:**

Backend:

- API: `GET /api/admin/tenants/:tenantId/layers`

  - Returnerar alla `layers` + info om plugin är aktiverat för tenant (`tenant_layers.enabled`, `settings`).

- API: `PUT /api/admin/tenants/:tenantId/layers/:layerKey`

  - Body: `{ enabled: boolean, settings?: any }`
  - När `enabled` går från `false` → `true`:

    - skapa `tenant_layers` rad (eller uppdatera)
    - seed `tenant_layer_acl` baserat på `defaults.tenantAclTemplate` (om du har tenant-ACL).

Frontend:

- Sida: `frontend/app/pages/admin/tenants/[id]/layers.vue`

  - Tabell: plugin namn, beskrivning, scopes.
  - Toggle “Enabled”.
  - Eget panel för “Tenant settings” (API-konto, standard-värden etc.).

**Acceptance criteria:**

- Tenant admin kan toggla `cloudflare_dns` på/av.
- När pluginet aktiveras skapas `tenant_layers` rad och ev. tenant-ACL seedas.

---

### 5.3. Org-nivå – aktivera plugin & sätta ACL

**Mål:** Org-admin ska:

- kunna aktivera/deaktivera plugin per org
- sätta vilka grupper som har CRUD på pluginet.

**Åtgärder:**

Backend:

- API: `GET /api/organizations/:orgId/layers`

  - Returnerar alla layers som är:

    - registrerade i `layers`
    - om du använder tenant-filter: bara de som är enabled på tenantnivå
  - Inkludera `organization_layers.enabled` & ev. `settings` plus ACL info.

- API: `PUT /api/organizations/:orgId/layers/:layerKey`

  - Body: `{ enabled: boolean, settings?: any }`
  - När `enabled` går från `false` → `true`:

    - skapa `organization_layers` rad
    - seed `organization_layer_acl` med `defaults.orgAclTemplate`:

      - mappa gruppernas namn (`Owners`, `Operations`, `Web`) till `organization_groups.name`.
      - om grupperna inte finns:

        - antingen skapa dem som `is_system = true`
        - eller hoppa över de grupperna.

- API: `PUT /api/organizations/:orgId/layers/:layerKey/acl`

  - Body: `{ acl: { [action: string]: number[] } }`

(ex: `{ read: [1,2], update: [1], delete: [1] }`, där siffrorna är group_ids)

  - Uppdaterar `organization_layer_acl` för varje action.

Frontend:

- Sida: `frontend/app/pages/organizations/[orgId]/layers/index.vue`

  - Lista alla plugins med:

    - Toggle: “Enabled for this organization”.
    - Länk: “Permissions”.
- Sida: `frontend/app/pages/organizations/[orgId]/layers/[layerKey]/permissions.vue`

  - Visa actions (create/read/update/delete).
  - För varje action: multi-select av organisationens grupper.
  - Spara-knapp som anropar `PUT /acl`.

**Acceptance criteria:**

- Org-admin kan aktivera `cloudflare_dns` och pluginet dyker då upp i UI för användare (om de har rätt).
- Org-admin kan ge/tar bort CRUD per grupp, vilket påverkar vad användarna kan göra.

---

## 6. Org-grupper: UI

**Mål:** En dedikerad sida där org-admin kan skapa/hantera grupper.

**Åtgärder:**

Backend:

- API: `GET /api/organizations/:orgId/groups`
- API: `POST /api/organizations/:orgId/groups`
- API: `PUT /api/organizations/:orgId/groups/:groupId`
- API: `DELETE /api/organizations/:orgId/groups/:groupId`
- API: `POST /api/organizations/:orgId/groups/:groupId/members`
- API: `DELETE /api/organizations/:orgId/groups/:groupId/members/:userId`

Frontend:

- Sida: `frontend/app/pages/organizations/[orgId]/settings/groups.vue`

  - Lista grupper.
  - Formulär för att skapa/uppdatera grupp.
  - Möjlighet att lägga till/ta bort medlemmar (ex. user-autocomplete).

**Acceptance criteria:**

- Org-admin kan skapa grupper som “Operations”, “Web”, “ServiceDesk”.
- Dessa grupper kan väljas i ACL-sidan för plugins.

---

## 7. Cloudflare DNS plugin: databas & struktur

**Mål:** Säkerställa att Cloudflare DNS följer plugin-konventionerna och prefixet `cloudflare_dns`.

**Åtgärder:**

I `/layers/cloudflare-dns/backend/drizzle/schema.ts`:

- Alla tabeller ska heta med prefix `cloudflare_dns_...`, t.ex.:

  - `cloudflare_dns_zones`
  - `cloudflare_dns_records`
  - `cloudflare_dns_sync_logs` (om du har loggar)

Justera migrations så att de:

- skapar tabellerna med prefix `cloudflare_dns_*`.
- ev. index/constraints följer samma prefix.

Strukturera pluginet:

```text
/layers/cloudflare-dns
  /backend
    /routes
      cloudflare-dns.routes.ts      // API endpoints för zoner/records
    /services
      cloudflare-dns.service.ts     // pratar med Cloudflare API
    /drizzle
      /migrations
        0001_cloudflare_dns_init.sql
      schema.ts
  /frontend
    /components
      CloudflareDnsZonesTable.vue
      CloudflareDnsRecordsTable.vue
    /pages
      dns/
        cloudflare/
          zones.vue
          records.vue
  layer.manifest.ts
  README.md
```

**Acceptance criteria:**

- Alla tabeller i Cloudflare-pluginet börjar med `cloudflare_dns_`.
- Pluginet använder inte längre hårdkodade RBAC-konstanter utan förlitar sig på ACL/permissions.

---

## 8. Frontend-moduler & visning baserat på plugin + ACL

**Mål:** Moduler (menu cards, dashboard-moduler etc.) ska visas:

- endast om pluginet är enabled för org
- endast om användaren har rättigheter (minst `read`).

**Åtgärder:**

Frontend helper (t.ex. `frontend/app/lib/modules-helpers.ts`):

- Lägg till funktion:

  - `isModuleAccessible(userContext, moduleKey)`:

    - hämtar tillhörande `layerKey` från din module registry eller från manifest metadata.
    - kollar:

      - om `layerKey` är enabled för activeOrg.
      - om `userContext.permissions` innehåller minst `'layer:<layerKey>:read'`.

Använd `isModuleAccessible`:

- i dashboard där du renderar modulkort.
- i huvudmeny/favoritmeny.
- i router guards (valfritt) för att hindra direktlänk utan behörighet.

**Acceptance criteria:**

- Om pluginet stängs av för en org, försvinner dess moduler från UI (även om länken fanns tidigare).
- Om en användare inte är med i någon grupp med `read`, syns inte modulen.

---

## 9. Plugin Guidelines – dokumentation för repo (och LLM)

**Mål:** En kort, konkret guide som en dev eller LLM kan följa för att skapa nya plugins.

**Åtgärder:**

Skapa `docs/plugin-guidelines.md` med ungefär innehållet:

```md
# Plugin / Layer Guidelines

This project supports modular "layers" (plugins) under `/layers/<layerKey>`.
Each plugin is self-contained and registers itself dynamically via a manifest.

## 1. Folder structure

Create a new folder:

- `/layers/<layerKey>/`

Recommended structure:

- `/backend` – Express routes, services, drizzle schema, migrations
- `/frontend` – Vue/Nuxt components, pages, composables
- `layer.manifest.ts` – Plugin metadata and configuration
- `README.md` – Short description and usage notes (optional but recommended)

Example:

```

/layers/cloudflare-dns

/backend

/routes

/services

/drizzle

/migrations

schema.ts

/frontend

/components

/pages

layer.manifest.ts

README.md

````

## 2. Layer manifest

Each plugin must export a default manifest from `layer.manifest.ts`:

```ts
import { defineLayer } from '@/layers/define-layer'

export default defineLayer({
  key: 'cloudflare_dns',
  type: 'plugin',
  displayName: 'Cloudflare DNS',
  description: 'Manage DNS via Cloudflare',
  version: '1.0.0',

  scopes: ['tenant', 'organization'],

  modules: [
    {
      moduleKey: 'cloudflare_dns.zones',
      route: '/dns/cloudflare/zones',
      icon: 'IconCloudflare',
      defaultVisibleOnDashboard: true,
    },
  ],

  capabilities: {
    actions: ['create', 'read', 'update', 'delete'],
  },

  migrations: {
    namespace: 'cloudflare_dns',
    path: 'backend/drizzle/migrations',
  },

  defaults: {
    orgAclTemplate: {
      create: ['Owners'],
      read: ['Owners', 'Operations', 'Web'],
      update: ['Owners', 'Operations'],
      delete: ['Owners'],
    },
    tenantAclTemplate: {
      create: ['TenantOwners'],
      read: ['TenantOwners'],
      update: ['TenantOwners'],
      delete: ['TenantOwners'],
    },
  },
})
````

The core system will:

1. Scan `/layers/*/layer.manifest.ts` on startup.
2. Validate and register each layer in the `layers` table.
3. Make the plugin visible in the global/tenant/organization plugin UIs.
4. Seed default ACL (CRUD) based on `defaults` when enabling the plugin for a tenant or organization.

## 3. Database & naming

- Use drizzle migrations in `backend/drizzle/migrations`.
- Prefix all plugin tables with the plugin namespace (e.g. `cloudflare_dns_*`).
- Example: `cloudflare_dns_zones`, `cloudflare_dns_records`.

## 4. ACL & permissions

Plugins should not hard-code permissions.

- The system will map plugin `actions` (create/read/update/delete)

to organization groups via ACL tables (`organization_layer_acl`).

- Use the existing RBAC helpers in backend to check permissions like:

  - `can('layer:cloudflare_dns:read')`
  - `can('layer:cloudflare_dns:update')`

These plugin permissions are derived dynamically from the organization’s group ACL configuration.

```

**Acceptance criteria:**

- Guiden finns i repot.
- Den beskriver hur man skapar ett nytt plugin utan att röra RBAC-konstanter.

---

Om du vill nästa steg kan vi bryta ned detta i konkreta Cursor-tasks per fil (med exakta filnamn och kod-skelett) så du bara kan klicka dig igenom implementationen.
```