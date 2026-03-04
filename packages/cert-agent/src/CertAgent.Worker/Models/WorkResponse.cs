using System.Text.Json.Serialization;

namespace CertAgent.Worker.Models;

/// <summary>
/// Response from GET /work endpoint.
/// </summary>
public sealed class WorkResponse
{
    [JsonPropertyName("runId")]
    public string RunId { get; set; } = string.Empty;

    [JsonPropertyName("leaseId")]
    public string LeaseId { get; set; } = string.Empty;

    [JsonPropertyName("leasedUntil")]
    public string LeasedUntil { get; set; } = string.Empty;

    [JsonPropertyName("payload")]
    public RunPayload? Payload { get; set; }

    [JsonPropertyName("dnsChallengeToken")]
    public string? DnsChallengeToken { get; set; }
}
