using CertAgent.Worker.Models;

namespace CertAgent.Worker.Helpers;

/// <summary>
/// Builds simple-acme (wacs.exe) CLI arguments from a RunPayload.
/// </summary>
public static class SimpleAcmeCommandBuilder
{
    public static string Build(RunPayload payload, string? secretFilePath, bool verbose = false)
    {
        var args = new List<string>();

        // Source: manual with explicit hosts
        args.Add("--source manual");

        // All domains via --host
        var allDomains = string.Join(",", payload.AllDomains);
        args.Add($"--host {allDomains}");

        // Common name = primary domain
        args.Add($"--commonname {payload.PrimaryDomain}");

        // ACME directory
        args.Add($"--baseuri {payload.Credential.AcmeDirectoryUrl}");

        // Accept TOS
        args.Add("--accepttos");

        // Friendly name (renewal identifier)
        var friendlyName = payload.RenewalName ?? payload.PrimaryDomain;
        args.Add($"--friendlyname \"{friendlyName}\"");

        // Close on finish (non-interactive)
        args.Add("--closeonfinish");

        // EAB credentials
        if (!string.IsNullOrEmpty(payload.Credential.EabKid))
        {
            args.Add($"--eab-key-identifier {payload.Credential.EabKid}");
        }
        if (!string.IsNullOrEmpty(secretFilePath))
        {
            // Use @file syntax to avoid exposing HMAC on command line
            args.Add($"--eab-key @{secretFilePath}");
        }

        // Validation method
        AddValidationArgs(args, payload);

        // Installation target
        AddInstallationArgs(args, payload);

        // Auto-renew control
        if (!payload.AutoRenew)
        {
            args.Add("--notaskscheduler");
        }

        // Verbose logging
        if (verbose)
        {
            args.Add("--verbose");
        }

        return string.Join(" ", args);
    }

    private static void AddValidationArgs(List<string> args, RunPayload payload)
    {
        var validationMeta = payload.ValidationMeta;

        if (payload.ValidationMethod == "http-01")
        {
            var httpMode = validationMeta?.GetValueOrDefault("httpMode")?.ToString() ?? "iis";

            switch (httpMode.ToLowerInvariant())
            {
                case "filesystem":
                    args.Add("--validation filesystem");
                    var webroot = validationMeta?.GetValueOrDefault("webroot")?.ToString();
                    if (!string.IsNullOrEmpty(webroot))
                        args.Add($"--validationpath \"{webroot}\"");
                    break;

                case "selfhosting":
                    args.Add("--validation selfhosting");
                    break;

                case "iis":
                default:
                    args.Add("--validation iis");
                    break;
            }
        }
        else if (payload.ValidationMethod == "dns-01")
        {
            var dnsProvider = validationMeta?.GetValueOrDefault("dnsProvider")?.ToString() ?? "manual";

            switch (dnsProvider.ToLowerInvariant())
            {
                case "cloudflare":
                    // Check if portal-managed (script-based) or native simple-acme plugin
                    var cfCreateScript = validationMeta?.GetValueOrDefault("dnsCreateScript")?.ToString();
                    var cfDeleteScript = validationMeta?.GetValueOrDefault("dnsDeleteScript")?.ToString();
                    if (!string.IsNullOrEmpty(cfCreateScript) && !string.IsNullOrEmpty(cfDeleteScript))
                    {
                        args.Add("--validation script");
                        args.Add($"--dnscreatescript \"{cfCreateScript}\"");
                        args.Add($"--dnsdeletescript \"{cfDeleteScript}\"");
                    }
                    else
                    {
                        args.Add("--validation cloudflare");
                    }
                    break;

                case "windows-dns":
                    var wdCreateScript = validationMeta?.GetValueOrDefault("dnsCreateScript")?.ToString();
                    var wdDeleteScript = validationMeta?.GetValueOrDefault("dnsDeleteScript")?.ToString();
                    if (!string.IsNullOrEmpty(wdCreateScript) && !string.IsNullOrEmpty(wdDeleteScript))
                    {
                        args.Add("--validation script");
                        args.Add($"--dnscreatescript \"{wdCreateScript}\"");
                        args.Add($"--dnsdeletescript \"{wdDeleteScript}\"");
                    }
                    else
                    {
                        args.Add("--validation manual"); // fallback
                    }
                    break;

                case "manual":
                default:
                    args.Add("--validation manual");
                    break;
            }
        }
    }

    private static void AddInstallationArgs(List<string> args, RunPayload payload)
    {
        var installMeta = payload.InstallationMeta;

        switch (payload.InstallationTarget.ToLowerInvariant())
        {
            case "iis":
                args.Add("--store certificatestore");
                args.Add("--installation iis");
                var siteId = installMeta?.GetValueOrDefault("siteId")?.ToString();
                if (!string.IsNullOrEmpty(siteId))
                    args.Add($"--installationsiteid {siteId}");
                break;

            case "pfx":
                args.Add("--store pfxfile");
                var outputPath = installMeta?.GetValueOrDefault("outputPath")?.ToString();
                if (!string.IsNullOrEmpty(outputPath))
                    args.Add($"--pfxfilepath \"{outputPath}\"");
                var pfxPassword = installMeta?.GetValueOrDefault("pfxPassword")?.ToString();
                if (!string.IsNullOrEmpty(pfxPassword))
                    args.Add($"--pfxpassword \"{pfxPassword}\"");
                break;

            case "centralssl":
                args.Add("--store centralssl");
                var storePath = installMeta?.GetValueOrDefault("storePath")?.ToString();
                if (!string.IsNullOrEmpty(storePath))
                    args.Add($"--centralsslstore \"{storePath}\"");
                break;

            case "manual":
            default:
                args.Add("--store pemfiles");
                var pemDir = installMeta?.GetValueOrDefault("outputDir")?.ToString();
                if (!string.IsNullOrEmpty(pemDir))
                    args.Add($"--pemfilespath \"{pemDir}\"");
                break;
        }
    }
}
