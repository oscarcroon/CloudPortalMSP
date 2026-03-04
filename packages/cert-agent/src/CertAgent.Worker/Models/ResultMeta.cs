using System.Text.Json.Serialization;

namespace CertAgent.Worker.Models;

/// <summary>
/// Certificate metadata extracted after successful issuance — matches RunResultMeta in types.ts.
/// </summary>
public sealed class ResultMeta
{
    [JsonPropertyName("serial")]
    public string? Serial { get; set; }

    [JsonPropertyName("thumbprint")]
    public string? Thumbprint { get; set; }

    [JsonPropertyName("expiresAt")]
    public string? ExpiresAt { get; set; }

    [JsonPropertyName("renewalId")]
    public string? RenewalId { get; set; }

    [JsonPropertyName("issuer")]
    public string? Issuer { get; set; }

    [JsonPropertyName("providerOrderId")]
    public string? ProviderOrderId { get; set; }

    [JsonPropertyName("acmeAccountThumbprint")]
    public string? AcmeAccountThumbprint { get; set; }
}
