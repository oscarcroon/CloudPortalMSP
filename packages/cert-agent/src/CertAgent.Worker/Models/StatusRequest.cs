using System.Text.Json.Serialization;

namespace CertAgent.Worker.Models;

/// <summary>
/// Request body for POST /runs/{runId}/status — extends lease and appends logs.
/// </summary>
public sealed class StatusRequest
{
    [JsonPropertyName("leaseId")]
    public string LeaseId { get; set; } = string.Empty;

    [JsonPropertyName("logs")]
    public string? Logs { get; set; }

    [JsonPropertyName("sequence")]
    public int Sequence { get; set; }
}

/// <summary>
/// Response from POST /runs/{runId}/status.
/// </summary>
public sealed class StatusResponse
{
    [JsonPropertyName("ok")]
    public bool Ok { get; set; }

    [JsonPropertyName("leasedUntil")]
    public string? LeasedUntil { get; set; }
}
