using System.Security.Cryptography.X509Certificates;
using CertAgent.Worker.Models;
using Microsoft.Extensions.Logging;

namespace CertAgent.Worker.Services;

/// <summary>
/// Extracts certificate metadata after successful issuance.
/// Supports Windows certificate store and file-based targets.
/// </summary>
public sealed class CertificateMetadataReader
{
    private readonly ILogger<CertificateMetadataReader> _logger;

    public CertificateMetadataReader(ILogger<CertificateMetadataReader> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Read certificate metadata based on the installation target.
    /// </summary>
    public ResultMeta? ReadMetadata(RunPayload payload)
    {
        try
        {
            return payload.InstallationTarget.ToLowerInvariant() switch
            {
                "iis" or "certificatestore" => ReadFromStore(payload),
                "pfx" => ReadFromPfxFile(payload),
                "centralssl" => ReadFromCentralSsl(payload),
                "manual" => ReadFromPemFiles(payload),
                _ => ReadFromStore(payload) // Fallback to store
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to read certificate metadata for {Domain}", payload.PrimaryDomain);
            return null;
        }
    }

    /// <summary>
    /// Read from Windows certificate store (LocalMachine\My).
    /// Finds certs matching primaryDomain with NotBefore within last 15 minutes.
    /// </summary>
    private ResultMeta? ReadFromStore(RunPayload payload)
    {
        using var store = new X509Store(StoreName.My, StoreLocation.LocalMachine);
        store.Open(OpenFlags.ReadOnly);

        var cutoff = DateTime.UtcNow.AddMinutes(-15);
        X509Certificate2? bestMatch = null;

        foreach (var cert in store.Certificates)
        {
            if (cert.NotBefore.ToUniversalTime() < cutoff)
                continue;

            if (CertMatchesDomain(cert, payload.PrimaryDomain))
            {
                if (bestMatch == null || cert.NotBefore > bestMatch.NotBefore)
                    bestMatch = cert;
            }
        }

        if (bestMatch == null)
        {
            _logger.LogWarning("No matching certificate found in store for {Domain}", payload.PrimaryDomain);
            return null;
        }

        _logger.LogInformation("Found certificate in store: Thumbprint={Thumbprint}, Subject={Subject}",
            bestMatch.Thumbprint, bestMatch.Subject);

        return ExtractMeta(bestMatch);
    }

    /// <summary>
    /// Read from a PFX file on disk.
    /// </summary>
    private ResultMeta? ReadFromPfxFile(RunPayload payload)
    {
        var outputPath = payload.InstallationMeta?.GetValueOrDefault("outputPath")?.ToString();
        if (string.IsNullOrEmpty(outputPath) || !File.Exists(outputPath))
        {
            _logger.LogWarning("PFX file not found at {Path}", outputPath);
            return null;
        }

        var password = payload.InstallationMeta?.GetValueOrDefault("pfxPassword")?.ToString();

        using var cert = password != null
            ? new X509Certificate2(outputPath, password)
            : new X509Certificate2(outputPath);

        return ExtractMeta(cert);
    }

    /// <summary>
    /// Read from Central SSL store directory.
    /// </summary>
    private ResultMeta? ReadFromCentralSsl(RunPayload payload)
    {
        var storePath = payload.InstallationMeta?.GetValueOrDefault("storePath")?.ToString();
        if (string.IsNullOrEmpty(storePath) || !Directory.Exists(storePath))
        {
            _logger.LogWarning("Central SSL store not found at {Path}", storePath);
            return null;
        }

        // Look for most recently written .pfx file matching the domain
        var pfxFiles = Directory.GetFiles(storePath, "*.pfx")
            .OrderByDescending(File.GetLastWriteTimeUtc)
            .ToList();

        foreach (var pfxFile in pfxFiles)
        {
            try
            {
                using var cert = new X509Certificate2(pfxFile);
                if (CertMatchesDomain(cert, payload.PrimaryDomain))
                    return ExtractMeta(cert);
            }
            catch
            {
                // Skip unreadable files
            }
        }

        _logger.LogWarning("No matching certificate found in Central SSL store for {Domain}", payload.PrimaryDomain);
        return null;
    }

    /// <summary>
    /// Read from PEM files directory.
    /// </summary>
    private ResultMeta? ReadFromPemFiles(RunPayload payload)
    {
        var pemDir = payload.InstallationMeta?.GetValueOrDefault("outputDir")?.ToString();
        if (string.IsNullOrEmpty(pemDir) || !Directory.Exists(pemDir))
        {
            _logger.LogWarning("PEM files directory not found at {Path}", pemDir);
            return null;
        }

        // Look for cert.pem or *.crt files
        var certFiles = Directory.GetFiles(pemDir, "*.pem")
            .Concat(Directory.GetFiles(pemDir, "*.crt"))
            .OrderByDescending(File.GetLastWriteTimeUtc)
            .ToList();

        foreach (var certFile in certFiles)
        {
            try
            {
                using var cert = X509Certificate2.CreateFromPemFile(certFile);
                if (CertMatchesDomain(cert, payload.PrimaryDomain))
                    return ExtractMeta(cert);
            }
            catch
            {
                // Skip files that aren't leaf certs
            }
        }

        _logger.LogWarning("No matching certificate found in PEM directory for {Domain}", payload.PrimaryDomain);
        return null;
    }

    private static bool CertMatchesDomain(X509Certificate2 cert, string domain)
    {
        // Check subject CN
        var commonName = cert.GetNameInfo(X509NameType.SimpleName, forIssuer: false);
        if (!string.IsNullOrWhiteSpace(commonName) &&
            commonName.Equals(domain, StringComparison.OrdinalIgnoreCase))
            return true;

        // Check SANs
        foreach (var ext in cert.Extensions)
        {
            if (ext is X509SubjectAlternativeNameExtension sanExt)
            {
                foreach (var dns in sanExt.EnumerateDnsNames())
                {
                    if (dns.Equals(domain, StringComparison.OrdinalIgnoreCase))
                        return true;
                }
            }
        }

        return false;
    }

    private static ResultMeta ExtractMeta(X509Certificate2 cert)
    {
        return new ResultMeta
        {
            Serial = cert.SerialNumber,
            Thumbprint = cert.Thumbprint,
            ExpiresAt = cert.NotAfter.ToUniversalTime().ToString("o"),
            Issuer = cert.Issuer
        };
    }
}
