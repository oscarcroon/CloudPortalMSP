# Windows DNS Layer

This layer integrates CloudPortalMSP with a Windows DNS management API, allowing organizations to manage DNS zones and records through the portal.

## Features

- **Zone Management**: List, create, and manage DNS zones
- **Record Management**: Create, update, and delete DNS records
- **Autodiscover**: Find zones matching an organization's COREID
- **Ownership Mapping**: Claim and manage zone ownership
- **Token-based Auth**: Short-lived tokens (5 min TTL) with scope-based access

## Architecture

### Hybrid Authentication

The layer uses a hybrid authentication model:

1. **Admin Provisioner Key** (server-only env var): Used for:
   - `ensure account` - Create/lookup accounts by COREID
   - `mint tokens` - Generate short-lived tokens

2. **Bearer Tokens** (5 min TTL): Used for all user-facing operations:
   - List zones
   - CRUD records
   - Autodiscover
   - Ownership management

### Token Caching

Tokens are cached per `orgId + accountId + scopes + zoneScopeHash`:
- **TTL**: 5 minutes
- **Safety Window**: 30 seconds (treats token as expired early)
- **Singleflight**: Only one mint per cache key at a time

## Configuration

### Environment Variables

Set the provisioner key in your server environment:

```bash
# Single instance
WINDOWSDNS_PROVISIONER_KEY=your-admin-key

# Multiple instances (optional)
WINDOWSDNS_PROVISIONER_KEY_PROD=key-for-prod-instance
WINDOWSDNS_PROVISIONER_KEY_DEV=key-for-dev-instance
```

### Organization Setup

Each organization needs:

1. **Base URL**: The Windows DNS API endpoint
2. **COREID**: The unique identifier (stored in WindowsDNS as `externalRef`)
3. **Instance ID** (optional): For multi-instance setups

Configure via the admin UI at `/windows-dns/admin` or programmatically through the config API.

## Permissions

| Permission | Description |
|------------|-------------|
| `windows-dns:view` | View zones and records |
| `windows-dns:zones:create` | Create new zones |
| `windows-dns:zones:write` | Modify existing zones |
| `windows-dns:records:write` | Create/update/delete records |
| `windows-dns:ownership:read` | View ownership mappings |
| `windows-dns:ownership:write` | Manage ownership (claim zones) |
| `windows-dns:autodiscover:read` | Run autodiscover |
| `windows-dns:manage_org_config` | Configure Windows DNS for org |

## API Endpoints

### Portal Endpoints (Nuxt Server Routes)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dns/windows/zones` | List zones |
| POST | `/api/dns/windows/zones` | Create zone |
| GET | `/api/dns/windows/zones/:zoneId/records` | List records |
| POST | `/api/dns/windows/zones/:zoneId/records` | Create record |
| GET | `/api/dns/windows/autodiscover/zones` | Run autodiscover |
| POST | `/api/dns/windows/zones/:zoneId/claim` | Claim zone ownership |
| GET | `/api/dns/windows/config` | Get org config |
| PUT | `/api/dns/windows/config` | Update org config |

## Data Flow

```
User → Portal UI → Nuxt API → [RBAC Check] → [Bootstrap Account] → [Get Token] → Windows DNS API
```

1. User makes request through Portal UI
2. Nuxt server route validates session and RBAC permissions
3. If `windowsDnsAccountId` missing, calls `ensure account` via admin key
4. Gets/mints token from cache (5 min TTL, singleflight)
5. Calls Windows DNS public API with bearer token
6. Returns filtered/authorized response to user

## Development

### Running Locally

1. Ensure Windows DNS API is running
2. Set `WINDOWSDNS_PROVISIONER_KEY` in your `.env`
3. Configure an org with base URL and COREID
4. Access via `/windows-dns`

### Files

```
layers/windows-dns/
├── module.manifest.ts          # Permissions and RBAC defaults
├── nuxt.config.ts              # Layer config
├── assets/css/windows-dns.css  # Module styles
├── components/                 # Vue components
│   ├── WindowsDnsZoneList.vue
│   └── WindowsDnsStatusCard.vue
├── pages/windows-dns/          # UI pages
│   ├── index.vue
│   └── autodiscover.vue
└── server/
    ├── api/dns/windows/        # Nuxt API routes
    └── lib/windows-dns/        # Server utilities
        ├── access.ts           # RBAC helpers
        ├── client.ts           # Windows DNS client
        ├── org-config.ts       # Org config storage
        ├── permissions-map.ts  # Permission → scope mapping
        ├── token-cache.ts      # Token caching
        └── types.ts            # TypeScript types
```

## Security Notes

- Admin provisioner key is **never** stored in database
- Tokens are short-lived (5 min) to minimize blast radius
- All state-changing operations are audited in Windows DNS
- Portal RBAC is enforced before any Windows DNS call
- Token scopes are derived from portal permissions (least privilege)

