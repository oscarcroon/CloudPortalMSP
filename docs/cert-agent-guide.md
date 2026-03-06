# Certificate Agent — Architecture & Operations Guide

This document describes the internal architecture, data flow, security model, and operational procedures for the CertAgent Windows Worker Service (`packages/cert-agent/`).

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Component Reference](#component-reference)
4. [Data Flow](#data-flow)
5. [Portal API Contract](#portal-api-contract)
6. [simple-acme Command Mapping](#simple-acme-command-mapping)
7. [Lease & Keepalive System](#lease--keepalive-system)
8. [Security Model](#security-model)
9. [Error Handling & Resilience](#error-handling--resilience)
10. [Certificate Metadata Extraction](#certificate-metadata-extraction)
11. [Scheduled Task Management](#scheduled-task-management)
12. [Building & Publishing](#building--publishing)
13. [Installation as Windows Service](#installation-as-windows-service)
14. [Configuration Reference](#configuration-reference)
15. [Logging & Diagnostics](#logging--diagnostics)
16. [Troubleshooting](#troubleshooting)

---

## Overview

The CertAgent is a .NET 8 Worker Service designed to run on Windows servers as a background service. It acts as a bridge between the CloudPortal (which manages certificate orders through a web UI) and `simple-acme` (wacs.exe), the ACME client that actually performs certificate issuance.

**Core responsibilities:**
- Poll the portal for pending certificate work orders
- Execute `simple-acme` with the correct CLI arguments
- Stream process output (logs) back to the portal in real-time
- Extract certificate metadata after issuance (thumbprint, serial, expiry)
- Report completion or failure back to the portal
- Send periodic heartbeats with agent health and capabilities

**Key design constraints:**
- Only one certificate run at a time (SemaphoreSlim lock)
- 10-minute lease on work items — extended via status calls
- Secrets (EAB HMAC) never appear in command-line arguments or logs
- Graceful shutdown reports `AGENT_SHUTDOWN` status

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CertAgent.Worker                         │
│                                                              │
│  ┌──────────────┐    ┌──────────────────┐                   │
│  │ HeartbeatWorker│    │ WorkPollingWorker │                   │
│  │  (60s loop)   │    │   (30s loop)      │                   │
│  └──────┬───────┘    └────────┬─────────┘                   │
│         │                     │                              │
│         │         ┌───────────┼───────────┐                  │
│         │         │           │           │                  │
│         │    ┌────▼────┐ ┌───▼────┐ ┌───▼──────────┐       │
│         │    │SimpleAcme│ │Secret  │ │LogStreaming   │       │
│         │    │Executor  │ │FileHelp│ │Service        │       │
│         │    └────┬─────┘ └───┬────┘ └──────┬───────┘       │
│         │         │           │              │               │
│         │    ┌────▼──────────▼──┐      ┌───▼──────────┐    │
│         │    │  CommandProfile  │      │  LogRedactor  │    │
│         │    │  + CmdBuilder    │      │  (redaction)  │    │
│         │    └──────────────────┘      └──────────────┘    │
│         │                                                    │
│    ┌────▼───────┐  ┌──────────────────┐                     │
│    │Scheduled   │  │CertificateMetadata│                     │
│    │TaskManager │  │Reader             │                     │
│    └────────────┘  └──────────────────┘                     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  PortalApiClient                      │   │
│  │  GET /work  POST /status  POST /complete  POST /hb   │   │
│  └──────────────────────┬───────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │ HTTPS + Bearer token
                          ▼
              ┌───────────────────────┐
              │   CloudPortal (Nuxt)  │
              │   /api/certificates/  │
              │     agent-api/        │
              └───────────────────────┘
```

### Workers (BackgroundService)

The agent runs two independent `BackgroundService` instances:

1. **HeartbeatWorker** — sends agent health info every 60s
2. **WorkPollingWorker** — polls for work every 30s, orchestrates certificate issuance

Both workers share the same `PortalApiClient` singleton but operate independently. A circuit breaker (`MaxConsecutiveApiFailures`) prevents infinite retry loops if the portal is unreachable.

---

## Component Reference

### Configuration Classes (`Configuration/`)

| Class | Config Section | Purpose |
|-------|---------------|---------|
| `PortalApiOptions` | `PortalApi` | Portal URL, agent token, HTTP timeout |
| `SimpleAcmeOptions` | `SimpleAcme` | wacs.exe path, version, timeouts, verbose |
| `AgentBehaviorOptions` | `AgentBehavior` | Poll/heartbeat/flush intervals, circuit breaker |

All options support environment variable overrides via `__` syntax: `PortalApi__AgentToken`, `SimpleAcme__ExecutablePath`, etc.

### Models (`Models/`)

| Class | Maps To | Direction |
|-------|---------|-----------|
| `WorkResponse` | `GET /work` response | Portal → Agent |
| `RunPayload` + `CredentialInfo` | `RunPayload` in types.ts | Portal → Agent |
| `StatusRequest` + `StatusResponse` | `POST /runs/{id}/status` | Agent → Portal |
| `CompleteRequest` + `CompleteResponse` | `POST /runs/{id}/complete` | Agent → Portal |
| `HeartbeatRequest` + `AgentCapabilities` | `POST /heartbeat` | Agent → Portal |
| `ResultMeta` | `RunResultMeta` in types.ts | Agent → Portal |

All models use `System.Text.Json` with `[JsonPropertyName("camelCase")]` attributes to match the portal's JSON conventions.

### Services (`Services/`)

| Service | Lifetime | Purpose |
|---------|----------|---------|
| `PortalApiClient` | Singleton | HTTP client wrapping all 4 portal endpoints with retry |
| `SimpleAcmeExecutor` | Singleton | Process management for wacs.exe (launch, capture output, timeouts, kill) |
| `LogStreamingService` | Transient | Per-run log buffering, periodic flush to portal, lease keepalive |
| `CertificateMetadataReader` | Singleton | X509 certificate metadata extraction from store or files |
| `ScheduledTaskManager` | Singleton | Windows Task Scheduler COM API for renewal task queries |

### Helpers (`Helpers/`)

| Helper | Type | Purpose |
|--------|------|---------|
| `SimpleAcmeCommandBuilder` | Static | Converts `RunPayload` → wacs.exe CLI argument string |
| `CommandProfile` / `DefaultCommandProfile` | Interface + impl | Version-aware CLI dialect (strategy pattern for future versions) |
| `LogRedactor` | Static | Regex-based secret scrubbing with static + dynamic patterns |
| `SecretFileHelper` | Static | Temp file creation with restrictive Windows ACL for EAB HMAC |
| `RetryPolicies` | Static | HTTP retry eligibility + exponential backoff with jitter |

---

## Data Flow

### Certificate Issuance (Happy Path)

```
1. WorkPollingWorker                  Portal
   │                                    │
   ├──── GET /work ────────────────────►│  (poll every 30s)
   │◄──── { runId, leaseId, payload } ──┤  (200 + RunPayload)
   │                                    │
   ├── Acquire run lock                 │
   ├── Start LogStreamingService        │
   ├── Write EAB HMAC to temp file      │
   ├── Build CLI args from payload      │
   │                                    │
   ├── Launch wacs.exe ──────┐          │
   │   ├─ stdout line ──────►├── AppendLine()
   │   ├─ stdout line ──────►│          │
   │   │   (every 5s flush)  │          │
   │   │◄─ POST /status { logs, seq } ─►│  (extends lease)
   │   ├─ stdout line ──────►│          │
   │   │   (30s keepalive)   │          │
   │   │◄─ POST /status { } ──────────►│  (extends lease, no logs)
   │   ├─ ...                │          │
   │   └─ exit code 0 ──────┘          │
   │                                    │
   ├── Read cert metadata (store scan)  │
   │                                    │
   ├──── POST /complete ───────────────►│  (status=completed, resultMeta)
   │◄──── { ok, status } ──────────────┤
   │                                    │
   ├── Delete temp secret file          │
   ├── Release run lock                 │
   └── Resume polling                   │
```

### Heartbeat (Independent Loop)

```
   HeartbeatWorker                    Portal
   │                                    │
   ├── Gather:                          │
   │   ├─ Agent version                 │
   │   ├─ simple-acme version           │
   │   ├─ OS info + hostname            │
   │   ├─ Renewal task status (COM API) │
   │   ├─ Renewal config count          │
   │   └─ Capabilities list             │
   │                                    │
   ├──── POST /heartbeat ─────────────►│
   │◄──── { ok } ──────────────────────┤
   │                                    │
   ├── Sleep 60s                        │
   └── Repeat                           │
```

### Failure Scenarios

| Scenario | Agent Behavior |
|----------|---------------|
| wacs.exe exits non-zero | POST /complete with `status=failed`, `errorCode=EXIT_{code}` |
| Hard timeout (25min) | Kill process tree, POST /complete with `errorCode=TIMEOUT` |
| Agent shutdown mid-run | Kill process, flush logs, POST /complete with `errorCode=AGENT_SHUTDOWN` (30s grace) |
| Unexpected exception | POST /complete with `errorCode=AGENT_ERROR` |
| Portal unreachable | Retry with backoff. After 10 consecutive failures → back off 1 minute |
| Auth failure (401/403) | No retry. Log error, wait 1 minute |
| Agent crash (no completion report) | Portal recovers: lease expires after 10 min → run reset to `pending` |

---

## Portal API Contract

All endpoints are under `/api/certificates/agent-api/` and require `Authorization: Bearer msp_agent.<prefix>.<secret>`.

### GET /work

Polls for the next pending run assigned to this agent.

**Response 200:**
```json
{
  "runId": "clx...",
  "leaseId": "cly...",
  "leasedUntil": "2026-03-02T19:00:00.000Z",
  "payload": {
    "runId": "clx...",
    "orderId": "clw...",
    "primaryDomain": "example.com",
    "subjectAlternativeNames": ["www.example.com"],
    "validationMethod": "http-01",
    "validationMeta": { "httpMode": "iis" },
    "installationTarget": "iis",
    "installationMeta": { "siteId": "1" },
    "autoRenew": true,
    "renewalName": "example-cert",
    "renewDaysBefore": 30,
    "credential": {
      "provider": "letsencrypt",
      "acmeDirectoryUrl": "https://acme-v02.api.letsencrypt.org/directory",
      "eabKid": null,
      "eabHmac": null
    }
  }
}
```

**Response 204:** No work available.

### POST /runs/{runId}/status

Streams logs and extends the lease. The `sequence` field enables idempotent deduplication on retry.

**Request:**
```json
{
  "leaseId": "cly...",
  "logs": "[2026-03-02 18:51:00] Generating certificate for example.com...\n",
  "sequence": 1
}
```

**Response:**
```json
{
  "ok": true,
  "leasedUntil": "2026-03-02T19:01:00.000Z"
}
```

### POST /runs/{runId}/complete

Reports final outcome. Idempotent via `leaseId + runId`.

**Success request:**
```json
{
  "leaseId": "cly...",
  "status": "completed",
  "resultMeta": {
    "serial": "03A1B2C3...",
    "thumbprint": "ABC123DEF456...",
    "expiresAt": "2026-06-01T00:00:00.000Z",
    "issuer": "CN=R11, O=Let's Encrypt, C=US"
  }
}
```

**Failure request:**
```json
{
  "leaseId": "cly...",
  "status": "failed",
  "errorMessage": "simple-acme exited with code 1",
  "errorCode": "EXIT_1",
  "logs": "[final output]\n"
}
```

### POST /heartbeat

**Request:**
```json
{
  "simpleAcmeVersion": "2.2.9.1",
  "renewalTaskStatus": "Ready",
  "renewalCount": 5,
  "os": "Microsoft Windows Server 2022 (X64)",
  "hostname": "WEB-PROD-01",
  "capabilities": {
    "supports": ["http-01", "iis", "pfx", "centralssl", "pemfiles"],
    "dnsProviders": []
  }
}
```

---

## simple-acme Command Mapping

The `SimpleAcmeCommandBuilder` translates a `RunPayload` into wacs.exe CLI arguments.

### Base Arguments (always included)

```
wacs.exe --source manual --host <domains> --commonname <primary>
         --baseuri <acmeUrl> --accepttos
         --friendlyname "<renewalName>" --closeonfinish
```

### Validation Method

| Payload | CLI Args |
|---------|----------|
| `http-01` + `httpMode: "iis"` (default) | `--validation iis` |
| `http-01` + `httpMode: "filesystem"` | `--validation filesystem --validationpath "<webroot>"` |
| `http-01` + `httpMode: "selfhosting"` | `--validation selfhosting` |
| `dns-01` + `dnsProvider: "cloudflare"` | `--validation cloudflare` |
| `dns-01` + `dnsProvider: "manual"` | `--validation manual` |

### Installation Target

| Payload | CLI Args |
|---------|----------|
| `iis` | `--store certificatestore --installation iis --installationsiteid <id>` |
| `pfx` | `--store pfxfile --pfxfilepath "<path>" [--pfxpassword "<pw>"]` |
| `centralssl` | `--store centralssl --centralsslstore "<path>"` |
| `manual` | `--store pemfiles --pemfilespath "<dir>"` |

### Conditional Flags

| Condition | CLI Args |
|-----------|----------|
| `autoRenew === false` | `--notaskscheduler` |
| `SimpleAcme.Verbose === true` | `--verbose` |
| EAB credentials present | `--eab-key-identifier <kid> --eab-key @<tempfile>` |

### Example Generated Command

```
wacs.exe --source manual --host example.com,www.example.com
         --commonname example.com
         --baseuri https://acme-v02.api.letsencrypt.org/directory
         --accepttos --friendlyname "example-cert" --closeonfinish
         --eab-key-identifier kid123 --eab-key @C:\Users\svc\AppData\Local\Temp\certagent-abc123.tmp
         --validation iis
         --store certificatestore --installation iis --installationsiteid 1
```

---

## Lease & Keepalive System

The portal assigns a **10-minute lease** when an agent picks up work. The agent must extend this lease before it expires, or the portal will assume the agent crashed and reset the run to `pending` for recovery.

### How Lease Extension Works

1. **Log flush (every 5s):** When buffered log lines exist, `LogStreamingService` flushes them via `POST /status`. Each status call extends the lease by another 10 minutes.

2. **Empty keepalive (every 30s):** When no log output has been produced (e.g., wacs.exe is waiting for DNS propagation during dns-01), the keepalive timer sends an empty status call `{ leaseId, logs: null, sequence: N }` to extend the lease.

3. **Sequence-based deduplication:** Each status call includes an incrementing `sequence` number. If the portal receives a retried call with `sequence <= lastLogSequence`, it skips log appending but still extends the lease. This prevents duplicate log entries on network retries.

### Timing Budget

```
Lease duration:     10 minutes
Keepalive interval: 30 seconds
Keepalive chances:  ~20 attempts before expiry
Hard timeout:       25 minutes (longest possible run)
```

With 30-second keepalive intervals, the agent has ~20 opportunities to extend the lease before it expires. This provides robust recovery even with intermittent network issues.

---

## Security Model

### Secret Protection: EAB HMAC

The EAB HMAC key (used for External Account Binding with some ACME providers like ZeroSSL) requires special handling because Windows exposes command-line arguments in process lists, Task Manager, and event logs.

**Protection chain:**

1. **Temp file with ACL** (`SecretFileHelper`):
   - HMAC written to `%TEMP%\certagent-<guid>.tmp`
   - Windows ACL restricted to current service account only (all inherited rules removed)
   - File path registered for log redaction

2. **File reference syntax** (`SimpleAcmeCommandBuilder`):
   - Passes `--eab-key @<tempfile>` instead of the raw HMAC value
   - Command-line never contains the secret

3. **Cleanup** (`WorkPollingWorker`):
   - Temp file deleted in `finally` block after process exits
   - Dynamic redaction patterns cleared between runs

### Log Redaction (Defense-in-Depth)

`LogRedactor` applies regex-based scrubbing to all process output before transmission. This mirrors the portal's server-side `LOG_REDACT_PATTERNS` and adds agent-specific patterns.

**Static patterns (always active):**

| Pattern | Replacement |
|---------|-------------|
| `--eab-key <value>` | `--eab-key [REDACTED]` |
| `--eab-key-identifier <value>` | `--eab-key-identifier [REDACTED]` |
| `PRIVATE KEY` | `[REDACTED]` |
| `Authorization: Bearer <token>` | `Authorization: Bearer [REDACTED]` |
| `password=<value>` or `password: <value>` | `password=[REDACTED]` |
| `--pfxpassword <value>` | `--pfxpassword [REDACTED]` |
| `--key <value>` | `--key [REDACTED]` |

**Dynamic patterns (per-run):**

| Source | Pattern | Replacement |
|--------|---------|-------------|
| `SecretFileHelper` | Temp file path (literal) | `[SECRET_FILE]` |

Dynamic patterns are cleared between runs via `LogRedactor.ClearDynamicPatterns()`.

### Bearer Token

The agent token is configured once in `PortalApiOptions.AgentToken` and set on the `HttpClient` via `DefaultRequestHeaders.Authorization`. It is never logged or included in process output.

---

## Error Handling & Resilience

### Retry Policy (PortalApiClient)

All HTTP calls go through `ExecuteWithRetryAsync` which provides:

- **Up to 3 retries** with exponential backoff (2^attempt seconds + random jitter, max 60s)
- **Retryable:** 5xx errors, 408 (timeout), 429 (rate limit)
- **Never retried:** 401 (unauthorized), 403 (forbidden)
- **Consecutive failure tracking:** `ConsecutiveFailures` counter, reset on success

### Circuit Breaker (WorkPollingWorker)

When `ConsecutiveFailures >= MaxConsecutiveApiFailures` (default: 10), the polling loop backs off for 1 minute instead of the normal 30s interval. This prevents hammering a degraded portal.

### Graceful Shutdown

When the service receives a stop signal (`CancellationToken`):

1. `SimpleAcmeExecutor` kills the running wacs.exe process tree
2. `LogStreamingService` flushes remaining buffered logs
3. `WorkPollingWorker` sends `POST /complete` with `errorCode: "AGENT_SHUTDOWN"` (30-second grace timeout)
4. If the completion report fails, the portal recovers via lease expiry

### Portal-Side Recovery

If the agent crashes without sending a completion report, the portal's `GET /work` handler recovers stale leases:
- Running runs with `leasedUntil < now` are reset to `pending`
- The next `GET /work` poll from any agent (or the same agent after restart) picks them up

---

## Certificate Metadata Extraction

After a successful wacs.exe run (exit code 0), `CertificateMetadataReader` extracts certificate details based on the installation target.

### Store-based targets (IIS, certificatestore)

1. Opens `X509Store(StoreName.My, StoreLocation.LocalMachine)`
2. Scans for certificates where:
   - Subject CN or SAN matches `primaryDomain`
   - `NotBefore` is within the last 15 minutes
3. If multiple matches, selects the one with the latest `NotBefore`
4. Extracts: `Serial`, `Thumbprint`, `ExpiresAt` (UTC ISO 8601), `Issuer`

### File-based targets

| Target | Strategy |
|--------|----------|
| PFX | `new X509Certificate2(filePath, password?)` directly |
| Central SSL | Scan directory for most recently written `.pfx` matching domain |
| Manual (PEM) | `X509Certificate2.CreateFromPemFile()` on `.pem`/`.crt` files |

### Metadata Reported to Portal

```json
{
  "serial": "03A1B2C3D4E5F6...",
  "thumbprint": "ABC123DEF456789...",
  "expiresAt": "2026-06-01T00:00:00.0000000Z",
  "issuer": "CN=R11, O=Let's Encrypt, C=US"
}
```

The portal uses this metadata to create a certificate record in the `cert_certificates` table with status `active`, calculate `nextRenewalAt` based on `renewDaysBefore`, and link it to the original order.

---

## Scheduled Task Management

`ScheduledTaskManager` uses the Windows Task Scheduler COM API (via the `TaskScheduler` NuGet package) to query renewal task status for heartbeat reporting.

### What It Does

- **Heartbeat reporting:** Queries the `\simple-acme` task folder for renewal tasks, reports status (`Ready`, `Running`, `Disabled`, etc.) and last/next run times.
- **Renewal config counting:** Counts `.renewal.json` files in simple-acme's `Renewals` directory.
- **Task verification:** After a successful run where `autoRenew === true`, verifies that simple-acme created its own scheduled task.

### What It Does NOT Do

- Does not create scheduled tasks — simple-acme handles this when `--notaskscheduler` is not passed.
- Does not modify or delete existing tasks.

---

## Building & Publishing

### Prerequisites

- .NET 8 SDK (`dotnet --version` >= 8.0)
- Windows (required for `net8.0-windows` TFM)

### Debug Build

```powershell
cd packages/cert-agent
dotnet build
```

### Release Build

```powershell
dotnet build -c Release
```

### Self-Contained Publish

Creates a single directory with all dependencies — no .NET runtime needed on the target machine:

```powershell
dotnet publish src/CertAgent.Worker -c Release -r win-x64 --self-contained -o ./publish
```

### Framework-Dependent Publish

Smaller output, requires .NET 8 Runtime on the target machine:

```powershell
dotnet publish src/CertAgent.Worker -c Release -r win-x64 --no-self-contained -o ./publish
```

### Running Tests

```powershell
dotnet test
```

31 tests covering:
- `SimpleAcmeCommandBuilderTests` (17 tests): all validation method/installation target combinations, EAB flags, auto-renew, verbose, default behavior
- `LogRedactorTests` (14 tests): all redaction patterns, dynamic patterns, case insensitivity, edge cases

---

## Installation as Windows Service

### Install

```powershell
# Copy published files to a permanent location
Copy-Item -Recurse ./publish C:\Services\CertAgent

# Create the Windows Service
sc.exe create CertAgent `
  binPath="C:\Services\CertAgent\CertAgent.Worker.exe" `
  start=auto `
  DisplayName="CloudPortal Certificate Agent"

sc.exe description CertAgent "Automated certificate issuance and renewal agent for CloudPortal"

# Configure recovery (restart on failure)
sc.exe failure CertAgent reset=86400 actions=restart/5000/restart/10000/restart/30000
```

### Configure

Place `appsettings.json` next to the executable, or use environment variables:

```powershell
# Set environment variables for the service
[System.Environment]::SetEnvironmentVariable(
  "PortalApi__AgentToken",
  "msp_agent.abc123.your-secret",
  [System.EnvironmentVariableTarget]::Machine
)
[System.Environment]::SetEnvironmentVariable(
  "PortalApi__BaseUrl",
  "https://portal.example.com",
  [System.EnvironmentVariableTarget]::Machine
)
```

### Start / Stop / Remove

```powershell
sc.exe start CertAgent
sc.exe stop CertAgent
sc.exe delete CertAgent
```

### Service Account (recommended)

For production, run the service under a dedicated service account with:
- Local Administrator rights (for certificate store access)
- Write access to the simple-acme config directory
- Network access to the portal and ACME provider

```powershell
sc.exe config CertAgent obj="DOMAIN\svc-certagent" password="..."
```

---

## Configuration Reference

### appsettings.json (full)

```json
{
  "PortalApi": {
    "BaseUrl": "https://portal.example.com",
    "AgentToken": "",
    "TimeoutSeconds": 30
  },
  "SimpleAcme": {
    "ExecutablePath": "C:\\simple-acme\\wacs.exe",
    "ConfigPath": "C:\\simple-acme",
    "MinVersion": "2.2.0",
    "SoftTimeoutMinutes": 8,
    "HardTimeoutMinutes": 25,
    "Verbose": false
  },
  "AgentBehavior": {
    "WorkPollIntervalSeconds": 30,
    "HeartbeatIntervalSeconds": 60,
    "LogFlushIntervalSeconds": 5,
    "LeaseKeepaliveIntervalSeconds": 30,
    "MaxConsecutiveApiFailures": 10
  },
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "System": "Warning"
      }
    },
    "WriteTo": [
      { "Name": "Console" },
      {
        "Name": "File",
        "Args": {
          "path": "logs/certagent-.log",
          "rollingInterval": "Day",
          "retainedFileCountLimit": 14
        }
      }
    ]
  }
}
```

### Environment Variable Override Examples

```powershell
PortalApi__BaseUrl=https://portal.example.com
PortalApi__AgentToken=msp_agent.abc123.secret
PortalApi__TimeoutSeconds=60
SimpleAcme__ExecutablePath=D:\tools\wacs.exe
SimpleAcme__HardTimeoutMinutes=30
AgentBehavior__WorkPollIntervalSeconds=15
Serilog__MinimumLevel__Default=Debug
```

---

## Logging & Diagnostics

### Log Locations

- **Console:** always enabled (useful for debugging as console app)
- **File:** `logs/certagent-YYYYMMDD.log` (rolling daily, 14-day retention)

### Log Levels

| Level | Used For |
|-------|----------|
| `Debug` | Heartbeat sent, keepalive sent, detailed process output |
| `Information` | Worker start/stop, work received, run completion, cert found |
| `Warning` | Soft timeout, retry attempts, failed heartbeat, failed keepalive |
| `Error` | Hard timeout, auth failure, too many consecutive failures |
| `Fatal` | Unhandled exception causing service termination |

### Key Log Messages to Monitor

```
# Agent started successfully
CertAgent.Worker starting

# Heartbeat working
Heartbeat sent

# Work received
Received work: RunId=clx..., Domain=example.com

# Successful completion
Run clx... completed successfully. Thumbprint=ABC123...

# Auth failure (needs attention)
POST /heartbeat authentication failed (Unauthorized). Check AgentToken.

# Circuit breaker triggered
Too many consecutive API failures (10) — backing off

# Soft timeout (usually OK for DNS-01)
simple-acme soft timeout (8min) reached — still running

# Hard timeout (process killed)
simple-acme hard timeout (25min) reached — killing process
```

---

## Troubleshooting

### Agent shows "Offline" in portal

1. Check the agent token: `PortalApi__AgentToken` must match exactly
2. Check the base URL: `PortalApi__BaseUrl` must be reachable from the agent
3. Check logs for auth errors: `authentication failed (Unauthorized)`
4. Verify network connectivity: the agent needs HTTPS access to the portal

### Heartbeat works but no certificate orders execute

1. Verify wacs.exe path: `SimpleAcme__ExecutablePath` must point to a valid file
2. Check if `simple-acme not found at ...` appears in logs
3. Ensure the service account has execute permissions on wacs.exe

### Certificate issued but metadata not reported

1. Check if the service account has read access to `LocalMachine\My` certificate store
2. For PFX/PEM targets, verify the output path exists and is accessible
3. Look for `Failed to read certificate metadata` in logs

### Run stays "running" forever in portal

1. The agent may have crashed — check Windows Event Log
2. The lease will expire after 10 minutes (if keepalives also failed)
3. The next `GET /work` poll will recover the run
4. Check `MaxConsecutiveApiFailures` — the agent may be in circuit-breaker backoff

### simple-acme keeps timing out

1. For DNS-01 validation: increase `HardTimeoutMinutes` (DNS propagation can take 10-20 min)
2. For HTTP-01: check that port 80 is accessible for validation
3. Check wacs.exe logs in the portal for specific ACME errors
4. Ensure the ACME directory URL is reachable from the agent

### EAB authentication failures

1. Verify the credential set in the portal has correct `eabKid` and `eabHmac`
2. Check that the EAB credentials haven't expired (some providers rotate them)
3. Look for ACME errors in the streamed logs (portal → order → run details)
