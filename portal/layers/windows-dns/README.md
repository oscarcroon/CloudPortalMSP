# Windows DNS Layer

This layer integrates CloudPortalMSP with a Windows DNS management API, allowing organizations to manage DNS zones and records through the portal.

## Features

- **Zone Management**: List, create, and manage DNS zones
- **Record Management**: Create, update, and delete DNS records
- **Autodiscover**: Find zones matching an organization's COREID
- **Ownership Mapping**: Claim and manage zone ownership
- **Token-based Auth**: Short-lived tokens (5 min TTL) with scope-based access

## Architecture

### Hybrid Authentication Model

The layer uses a hybrid authentication model with two token types:

1. **LayerToken (System Token)** - `wdns_sys_*` prefix:
   - Server-only env var (`WINDOWS_DNS_LAYER_TOKEN`)
   - Used for **bootstrap operations only**:
     - `ensure account` - Create/lookup accounts by COREID
     - `mint tokens` - Generate per-account tokens
   - Calls `/api/v1/system/*` endpoints

2. **Per-Account Tokens** - `wdns_tok_*` prefix:
   - Generated dynamically via system API
   - Short-lived (5 min TTL)
   - Used for **drift operations**:
     - List zones, records
     - CRUD records
     - Autodiscover
     - Ownership management
   - Calls `/api/v1/*` endpoints

### Token Flow

```
Portal Request
    ↓
RBAC Check (portal permissions)
    ↓
Get/Mint Per-Account Token (using LayerToken → system API)
    ↓
Call Windows DNS Public API (using per-account token)
    ↓
Return filtered response
```

### Token Caching

Per-account tokens are cached per `orgId + accountId + scopes + zoneScopeHash`:
- **TTL**: 5 minutes
- **Safety Window**: 30 seconds (treats token as expired early)
- **Singleflight**: Only one mint per cache key at a time

## Configuration

### Environment Variables

Set in your server environment (`.env` or secrets):

```bash
# Required: Windows DNS Layer API base URL
WINDOWS_DNS_API_URL=http://windowsdns-layer:4001/api/v1

# Required: LayerToken (system token) for bootstrap operations
# Created in WindowsDNS Admin Panel → Integrations → CoreAPI Integration
WINDOWS_DNS_LAYER_TOKEN=wdns_sys_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx...

# Optional: Admin key (WindowsDNS backend) for NS status endpoints
# Only required if you want to use: GET /api/dns/windows/zones/ns-status
WINDOWS_DNS_ADMIN_KEY=your-admin-key

# Optional: HMAC pepper for hashing (set in WindowsDNS Layer API)
# SYSTEM_TOKEN_PEPPER=your-secret-pepper
```

#### Multi-Instance Setup (Optional)

For multiple WindowsDNS instances:

```bash
# Instance-specific configuration
WINDOWS_DNS_API_URL_PROD=https://dns-api-prod.example.com/api/v1
WINDOWS_DNS_LAYER_TOKEN_PROD=wdns_sys_...

WINDOWS_DNS_API_URL_DEV=https://dns-api-dev.example.com/api/v1
WINDOWS_DNS_LAYER_TOKEN_DEV=wdns_sys_...
```

Then set `instanceId` in the organization config.

### Organization Setup

Each organization needs:

1. **COREID**: The unique identifier (stored in WindowsDNS as `externalRef`)
2. **Instance ID** (optional): For multi-instance setups

The base URL is now **global** via `WINDOWS_DNS_API_URL` (not per-org).

Configure via the admin UI at `/windows-dns/admin` or programmatically.

### COREID Marker Format

To link a DNS zone to an organization, create a TXT record on the `_coreid` subdomain:

```
_coreid.<zone>   TXT   "COREID=<organization-id>"
```

**Example for `example.com`:**
```
_coreid.example.com.   3600   IN   TXT   "COREID=ABCD"
```

The marker record:
- Is automatically created when a zone is created via the portal
- Is hidden from the UI to prevent accidental modification
- Cannot be modified or deleted via the public API (protected)
- Is used by autodiscover to match zones to organizations

### Obtaining a LayerToken

1. Go to **WindowsDNS Admin Panel**
2. Navigate to **Integrations → CoreAPI Integration**
3. Click **"Skapa LayerToken"** (Create LayerToken)
4. Copy the token (shown only once!)
5. Set `WINDOWS_DNS_LAYER_TOKEN` in your environment

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
| GET | `/api/dns/windows/zones` | List zones (auto-sync for admins) |
| POST | `/api/dns/windows/zones` | Create zone |
| GET | `/api/dns/windows/zones/:zoneId/records` | List records |
| POST | `/api/dns/windows/zones/:zoneId/records` | Create record |
| GET | `/api/dns/windows/zones/manage` | Get zones for admin management |
| POST | `/api/dns/windows/zones/block` | Hide zones (remove access) |
| POST | `/api/dns/windows/zones/unblock` | Unhide/activate zones |
| GET | `/api/dns/windows/autodiscover/zones` | Run autodiscover |
| POST | `/api/dns/windows/autodiscover/activate` | Activate discovered zones |
| POST | `/api/dns/windows/zones/:zoneId/claim` | Claim zone ownership |
| GET | `/api/dns/windows/config` | Get org config |
| PUT | `/api/dns/windows/config` | Update org config |

### Windows DNS Layer API Endpoints

#### System API (requires LayerToken)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/system/accounts/ensure` | Ensure account exists |
| POST | `/api/v1/system/accounts/:id/tokens` | Mint per-account token |

#### Public API (requires per-account token)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/zones` | List zones |
| POST | `/api/v1/zones` | Create zone |
| GET | `/api/v1/zones/:id/dns_records` | List records |
| POST | `/api/v1/zones/:id/dns_records` | Create record |
| PATCH | `/api/v1/zones/:id/dns_records/:recordId` | Update record |
| DELETE | `/api/v1/zones/:id/dns_records/:recordId` | Delete record |
| GET | `/api/v1/autodiscover/zones` | Autodiscover zones |

## Data Flow

```
User → Portal UI → Nuxt API → [RBAC Check] → [Bootstrap Account] → [Get Token] → Windows DNS API
```

1. User makes request through Portal UI
2. Nuxt server route validates session and RBAC permissions
3. If `windowsDnsAccountId` missing, calls `ensure account` via LayerToken
4. Gets/mints per-account token from cache (5 min TTL, singleflight)
5. Calls Windows DNS public API with bearer token
6. Returns filtered/authorized response to user

## Development

### Running Locally

1. Ensure WindowsDNS Layer API is running at `WINDOWS_DNS_API_URL`
2. Create a LayerToken in the WindowsDNS Admin Panel
3. Set environment variables in your `.env`:
   ```bash
   WINDOWS_DNS_API_URL=http://localhost:4001/api/v1
   WINDOWS_DNS_LAYER_TOKEN=wdns_sys_...
   ```
4. Configure an org with COREID
5. Access via `/windows-dns`

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

- **LayerToken** is **never** stored in database - server-only env var
- LayerToken can **only** access `/api/v1/system/*` endpoints (bootstrap)
- Per-account tokens are short-lived (5 min) to minimize blast radius
- LayerToken minting enforces scope whitelist + TTL clamp server-side
- All state-changing operations are audited in Windows DNS
- Portal RBAC is enforced before any Windows DNS call
- Token scopes are derived from portal permissions (least privilege)
- `records.*` scopes require `allowedZoneIds` (security guardrail)
