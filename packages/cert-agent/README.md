# CertAgent — Certificate Automation Agent

A .NET 8 Windows Worker Service that polls the CloudPortal for certificate work orders, executes [simple-acme](https://simple-acme.com/) (wacs.exe) to issue/renew certificates via ACME, streams logs back in real-time, and reports certificate metadata on completion.

Runs as a **Windows Service** or standalone console app on any Windows server where certificates need to be managed.

## Quick Start

### Prerequisites

- .NET 8 SDK (build) or .NET 8 Runtime (deploy)
- Windows Server 2016+ (for Windows Service support)
- [simple-acme](https://simple-acme.com/) (`wacs.exe`) installed (default: `C:\simple-acme\wacs.exe`)
- An agent token from the CloudPortal (format: `msp_agent.<prefix>.<secret>`)

### Build

```powershell
cd packages/cert-agent
dotnet build -c Release
```

Output: `src/CertAgent.Worker/bin/Release/net8.0-windows/`

### Publish (self-contained)

```powershell
dotnet publish src/CertAgent.Worker -c Release -r win-x64 --self-contained -o ./publish
```

### Configure

Edit `appsettings.json` or set environment variables:

```powershell
# Required
$env:PortalApi__BaseUrl = "https://portal.example.com"
$env:PortalApi__AgentToken = "msp_agent.abc123.your-secret-token"

# Optional — override simple-acme path
$env:SimpleAcme__ExecutablePath = "C:\simple-acme\wacs.exe"
```

### Run as Console

```powershell
cd src/CertAgent.Worker
dotnet run
```

### Install as Windows Service

```powershell
sc.exe create CertAgent binPath="C:\path\to\CertAgent.Worker.exe" start=auto
sc.exe description CertAgent "CloudPortal Certificate Automation Agent"
sc.exe start CertAgent
```

### Run Tests

```powershell
cd packages/cert-agent
dotnet test
```

## Configuration Reference

See [`appsettings.json`](src/CertAgent.Worker/appsettings.json) for all options. Every setting supports environment variable override via `__` syntax (e.g. `PortalApi__AgentToken`).

| Section | Key | Default | Description |
|---------|-----|---------|-------------|
| `PortalApi` | `BaseUrl` | `https://portal.example.com` | Portal URL |
| | `AgentToken` | *(empty)* | Agent bearer token (`msp_agent.<prefix>.<secret>`) |
| | `TimeoutSeconds` | `30` | HTTP request timeout |
| `SimpleAcme` | `ExecutablePath` | `C:\simple-acme\wacs.exe` | Path to wacs.exe |
| | `ConfigPath` | `C:\simple-acme` | simple-acme config/working directory |
| | `MinVersion` | `2.2.0` | Minimum supported simple-acme version |
| | `SoftTimeoutMinutes` | `8` | Log warning after this (process continues) |
| | `HardTimeoutMinutes` | `25` | Kill process after this |
| | `Verbose` | `false` | Pass `--verbose` to wacs.exe |
| `AgentBehavior` | `WorkPollIntervalSeconds` | `30` | How often to check for work |
| | `HeartbeatIntervalSeconds` | `60` | How often to send heartbeat |
| | `LogFlushIntervalSeconds` | `5` | Log buffer flush interval |
| | `LeaseKeepaliveIntervalSeconds` | `30` | Empty keepalive to extend lease |
| | `MaxConsecutiveApiFailures` | `10` | Circuit breaker threshold |

## Project Structure

```
packages/cert-agent/
├── CertAgent.sln
├── src/CertAgent.Worker/
│   ├── Program.cs                          Entry point, DI, Serilog, Windows Service
│   ├── Configuration/                      Options classes (bound from appsettings)
│   ├── Models/                             DTOs matching portal API contracts
│   ├── Services/
│   │   ├── PortalApiClient.cs              HTTP client for all 4 agent-api endpoints
│   │   ├── SimpleAcmeExecutor.cs           Process management + output capture
│   │   ├── LogStreamingService.cs          Buffered log shipping + lease keepalive
│   │   ├── CertificateMetadataReader.cs    X509 store/file metadata extraction
│   │   └── ScheduledTaskManager.cs         Task Scheduler COM API for renewals
│   ├── Workers/
│   │   ├── WorkPollingWorker.cs            Main work loop (single-run lock)
│   │   └── HeartbeatWorker.cs              Independent heartbeat loop
│   └── Helpers/
│       ├── SimpleAcmeCommandBuilder.cs     RunPayload → wacs.exe CLI args
│       ├── CommandProfile.cs               Version-aware CLI dialect
│       ├── LogRedactor.cs                  Client-side secret scrubbing
│       ├── SecretFileHelper.cs             Temp file with ACL for EAB HMAC
│       └── RetryPolicies.cs               Retry + backoff configuration
└── tests/CertAgent.Tests/
    └── Helpers/
        ├── SimpleAcmeCommandBuilderTests.cs   17 tests
        └── LogRedactorTests.cs                14 tests
```

## Portal API Contract

The agent communicates with 4 endpoints under `/api/certificates/agent-api/`, authenticated via `Bearer msp_agent.<prefix>.<secret>`:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/work` | Poll for pending work (204 = no work) |
| `POST` | `/runs/{runId}/status` | Stream logs + extend 10-min lease |
| `POST` | `/runs/{runId}/complete` | Report success/failure + cert metadata |
| `POST` | `/heartbeat` | Agent health + capabilities |

## Security

- **EAB HMAC** is never placed on the command line — written to a temp file with restrictive Windows ACL, referenced via `--eab-key @<file>`, and deleted after the process exits.
- **Log redaction** (defense-in-depth) scrubs secrets from stdout/stderr before transmission — matches portal-side patterns.
- **Bearer token** is set once in the HTTP client and never logged.
- Agent token supports the `msp_agent.<prefix>.<secret>` format with scrypt-v1 hashing on the portal side.
