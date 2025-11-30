# Modul-arkitektur och RBAC

Detta dokument beskriver hur man skapar och hanterar moduler i CloudPortalMSP.

## Översikt

Moduler är standardiserade komponenter som kan läggas till i dashboarden. Varje modul har:
- Ett unikt ID
- Metadata (namn, beskrivning, kategori, ikon)
- Koppling till RBAC-permissions
- En route-path för navigation

Moduler styrs via en hierarkisk policy-struktur:
- **Distributör-nivå**: Sätter baseline för vilka moduler och permissions som är tillgängliga
- **Leverantör-nivå**: Kan begränsa (men inte utöka) vad distributören tillåter
- **Organisations-nivå**: Kan ytterligare begränsa (men inte utöka) vad tenant-nivåerna tillåter

## Skapa en ny modul

### 1. Definiera modul-ID och permissions

Först, lägg till modul-ID:t i `frontend/src/constants/modules.ts`:

```typescript
export const moduleIds = [
  'cloudflare',
  'containers',
  // ... befintliga moduler
  'my-new-module'  // Lägg till här
] as const
```

Lägg sedan till permission-mapping:

```typescript
export const modulePermissionMap: Record<ModuleId, RbacPermission[]> = {
  // ... befintliga mappings
  'my-new-module': ['my-module:read', 'my-module:write']
}
```

**OBS**: Om du behöver nya permissions, lägg till dem i `frontend/src/constants/rbac.ts`:

```typescript
export const rbacPermissions = [
  // ... befintliga permissions
  'my-module:read',
  'my-module:write'
] as const
```

Och uppdatera `rolePermissionMap` för att ge rätt roller dessa permissions.

### 2. Skapa modul-mapp och definition

Skapa en mapp under `frontend/src/lib/modules/`:

```
frontend/src/lib/modules/my-new-module/
  ├── index.ts          # Moduldefinition
  └── (eventuella komponenter)
```

I `index.ts`, definiera modulen:

```typescript
import type { ModuleDefinition } from '~/constants/modules'

export const myNewModule: ModuleDefinition = {
  id: 'my-new-module',
  name: 'Min nya modul',
  description: 'Beskrivning av vad modulen gör.',
  category: 'infrastructure', // eller 'dns', 'monitoring', 'cms', 'rmm', 'admin'
  permissions: ['my-module:read', 'my-module:write'],
  routePath: '/my-module',
  icon: 'mdi:icon-name',
  badge: 'Badge text' // valfritt
}
```

### 3. Registrera modulen

Lägg till modulen i `frontend/src/lib/modules/index.ts`:

```typescript
import { myNewModule } from './my-new-module'

export const moduleRegistry: ModuleDefinition[] = [
  // ... befintliga moduler
  myNewModule
]
```

### 4. Skapa route och komponenter

Skapa en sida för modulen i `frontend/src/pages/`:

```vue
<!-- frontend/src/pages/my-module/index.vue -->
<template>
  <section>
    <h1>Min nya modul</h1>
    <!-- Modulens innehåll -->
  </section>
</template>

<script setup lang="ts">
// Använd requirePermission i server-side API-routes
// eller usePermission() i frontend för att kontrollera rättigheter
</script>
```

### 5. Skapa API-routes (om nödvändigt)

Om modulen behöver backend-funktionalitet, skapa routes under `frontend/src/server/api/`:

```typescript
// frontend/src/server/api/my-module/index.get.ts
import { requirePermission } from '~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  // requirePermission kontrollerar automatiskt modulpolicy
  await requirePermission(event, 'my-module:read', orgId)
  
  // Din logik här
  return { data: [] }
})
```

## Modulpolicy-hantering

### För utvecklare

Modulpolicy hanteras automatiskt av systemet. När du använder `requirePermission()` i server-side routes kontrolleras:
1. Om användaren har RBAC-permission (via roll)
2. Om modulen är aktiverad för organisationen
3. Om permissionen är tillåten enligt modulpolicy

### För administratörer

**Tenant-nivå (Distributör/Leverantör)**:
- Gå till `/admin/tenants/[id]/modules`
- Aktivera/inaktivera moduler
- Begränsa specifika permissions

**Organisations-nivå**:
- Gå till `/settings/modules`
- Aktivera/inaktivera moduler (kan inte aktivera något som är inaktiverat på tenant-nivå)
- Ytterligare begränsa permissions (kan inte aktivera något som är inaktiverat på tenant-nivå)

## Modulspecifika roller

Vissa moduler (t.ex. DNS och VMs) definierar egna roller, t.ex. `DNS Administratör` och `DNS Reader`. Dessa roller styr vilka användare som får se modulen och vilka möjligheter de har inuti modulen.

### Datamodell
- `module_roles`: definierar vilka modulroller som finns per modul (`sync-module-roles.ts` synkar definitionerna).
- `role_module_role_mappings`: kopplar RBAC-roller (owner/admin/operator/...) till modulroller. Basvärden kommer från `frontend/app/constants/moduleRoleMappings.ts` men tabellen kan senare utökas via UI.
- `member_module_role_overrides`: lagrar manuella *grants* och *denies* per användare/modul. `grant` lägger till extra modulroller, `deny` tar bort roller som annars skulle ges via RBAC.

Effektiv rollberäkning sker enligt:

```
effective = (rbac_defaults ∪ explicit_grants) \ explicit_denies
```

Explicit deny har alltid högre prioritet än RBAC/default.

### Standardvärden från RBAC
- Filen `frontend/app/constants/moduleRoleMappings.ts` beskriver vilka modulroller som gäller för respektive organisationsroll (`owner`, `admin`, `operator`, m.fl.) och används för att seed:a databasen.
- Om en användare inte har några manuella overrides visas alltid standardmappningen baserad på deras RBAC-roll. När man tar bort en manuell tilldelning återgår användaren automatiskt till RBAC-standard.

### Hantering via UI
- **Per modul (`/settings/modules`)**: Expandera en modul och använd kolon­nen *Modulroller* för att toggla roller per användare. Varning visas om rollerna är låsta högre upp i hierarkin (distributör eller leverantör). Knappen “Återställ standard” tar bort alla manuella roller för den modulen.
- **Per medlem (`/settings/members`)**: Via åtgärden *Modulroller* öppnas en panel där alla moduler för en specifik användare listas. Här visas vilka roller som gäller, om de kommer från RBAC eller är manuellt satta samt vilka roller som är tillåtna. Ändringarna sparas i bulk via `PUT /members/{memberId}/module-roles`.
- UI:n visar också om roller kommer från RBAC (badge “Ärvd via RBAC”), om det finns manuella overrides (+/- räknare) och erbjuder snabb “Återställ standard”.

### Blockeringar
- Om distributör- eller leverantörsnivån har blockerat en moduls roller visas detta tydligt i både tenant-UI och organisations-UI. Alla kontroll­element är då inaktiverade och det går inte att tilldela roller på lägre nivåer.

## Exempel: Cloudflare DNS-modulen

Cloudflare DNS-modulen är ett komplett exempel på hur en modul implementeras:

1. **Moduldefinition**: `frontend/src/lib/modules/cloudflare/index.ts`
2. **Permissions**: `cloudflare:read`, `cloudflare:write` (definierade i `rbac.ts`)
3. **Route**: `/dns` (definierat i moduldefinitionen)
4. **Sida**: `frontend/src/pages/dns/index.vue`
5. **API-routes**: `frontend/src/server/api/dns/*` (använder `requirePermission`)

## Best practices

1. **Använd tydliga permission-namn**: Följ mönstret `module-id:action` (t.ex. `cloudflare:read`)
2. **Gruppera relaterade moduler**: Använd kategorier för att gruppera moduler i UI
3. **Dokumentera permissions**: Beskriv vad varje permission gör i admin-UI
4. **Testa policy-arv**: Verifiera att policy-arv fungerar korrekt mellan distributör → leverantör → organisation
5. **Använd modulregistret**: Använd alltid `getAllModules()` eller `getModuleById()` istället för hårdkodade listor

## Felsökning

**Modulen visas inte på dashboarden**:
- Kontrollera att modulen är registrerad i `modules/index.ts`
- Verifiera att modulen är aktiverad för organisationen
- Kontrollera att användaren har minst en av modulens permissions

**Permission-checks misslyckas**:
- Verifiera att permissionen är definierad i `rbac.ts`
- Kontrollera att användarens roll har permissionen
- Verifiera att modulpolicy inte blockerar permissionen

**Policy-arv fungerar inte**:
- Kontrollera att organisationen har en korrekt `tenantId`
- Verifiera att distributör-leverantör-kopplingar är korrekta
- Kontrollera att policy är satt på rätt nivå i hierarkin

## Login-branding och domäner

Login-sidan brändas nu med samma arv som appen:

- Varje nivå (distributör, leverantör, organisation) kan ladda upp egna login-logotyper (ljus/mörk) och bakgrundsbilder via logo-endpoints med `variant` (t.ex. `variant=login-light`, `variant=login-dark`, `variant=login-background`).
- `GET /api/login-branding` avgör aktiv branding baserat på host. Slug-subdomäner definieras via `LOGIN_BRANDING_SLUG_SUFFIXES` (t.ex. `.portal.coreit.cloud`). Verifierade custom domains ersätter slug-lösningen.
- Bakgrundstint och intensitet sparas via `loginBackgroundTint` + `loginBackgroundTintOpacity` i `PUT /api/organizations/:id/branding`, `PUT /api/admin/tenants/:id/branding` samt `PUT /api/admin/branding` (global default).
- Navigationsbakgrunden i huvudmenyn styrs via `navigationBackgroundColor`; lämna `null` för mörk standard. UI finns på `/settings/branding` (organisation) och `/admin/branding` (global).

Custom domains hanteras via:

- `PUT /api/admin/tenants/:id/domain` – normaliserar domänen (utan schema/port/path) och sätter status `unverified`.
- `POST /api/admin/tenants/:id/domain/verify` – mock-verifierar (sätter `verified` + `customDomainVerifiedAt`).

UI:

- Organisationer: `/settings/branding` → fliken *Login-branding*.
- Tenants (admins): `/admin/tenants/[id]/branding` → *Login-branding* samt kortet **Login-domän** för CNAME/verification.
- SuperAdmins: `/admin/branding` för att sätta global default-branding (app + login).

Miljövariabler:

```
LOGIN_BRANDING_SLUG_SUFFIXES=.portal.coreit.cloud
LOGIN_BRANDING_ALLOW_UNVERIFIED=false
```

- Sätt `LOGIN_BRANDING_ALLOW_UNVERIFIED=true` i dev för att tillåta custom domains utan verifiering.
- Publik runtime (`runtimeConfig.public.loginBranding.slugSuffixes`) används för att visa standarddomänen i UI.

