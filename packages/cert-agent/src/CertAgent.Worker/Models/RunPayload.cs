using System.Text.Json.Serialization;

namespace CertAgent.Worker.Models;

/// <summary>
/// Immutable work payload sent by the portal — matches RunPayload in types.ts.
/// </summary>
public sealed class RunPayload
{
    [JsonPropertyName("runId")]
    public string RunId { get; set; } = string.Empty;

    [JsonPropertyName("orderId")]
    public string OrderId { get; set; } = string.Empty;

    [JsonPropertyName("primaryDomain")]
    public string PrimaryDomain { get; set; } = string.Empty;

    [JsonPropertyName("subjectAlternativeNames")]
    public List<string> SubjectAlternativeNames { get; set; } = [];

    [JsonPropertyName("validationMethod")]
    public string ValidationMethod { get; set; } = "http-01";

    [JsonPropertyName("validationMeta")]
    public Dictionary<string, object>? ValidationMeta { get; set; }

    [JsonPropertyName("installationTarget")]
    public string InstallationTarget { get; set; } = "iis";

    [JsonPropertyName("installationMeta")]
    public Dictionary<string, object>? InstallationMeta { get; set; }

    [JsonPropertyName("autoRenew")]
    public bool AutoRenew { get; set; } = true;

    [JsonPropertyName("renewalName")]
    public string? RenewalName { get; set; }

    [JsonPropertyName("renewDaysBefore")]
    public int RenewDaysBefore { get; set; } = 30;

    [JsonPropertyName("credential")]
    public CredentialInfo Credential { get; set; } = new();

    /// <summary>
    /// All domains (primary + SANs) as a single list.
    /// </summary>
    [JsonIgnore]
    public IReadOnlyList<string> AllDomains
    {
        get
        {
            var domains = new List<string> { PrimaryDomain };
            domains.AddRange(SubjectAlternativeNames);
            return domains;
        }
    }
}

public sealed class CredentialInfo
{
    [JsonPropertyName("provider")]
    public string Provider { get; set; } = string.Empty;

    [JsonPropertyName("acmeDirectoryUrl")]
    public string AcmeDirectoryUrl { get; set; } = string.Empty;

    [JsonPropertyName("eabKid")]
    public string? EabKid { get; set; }

    [JsonPropertyName("eabHmac")]
    public string? EabHmac { get; set; }
}
