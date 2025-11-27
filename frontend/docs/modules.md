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

