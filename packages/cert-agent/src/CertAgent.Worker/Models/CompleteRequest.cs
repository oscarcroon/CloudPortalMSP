using System.Text.Json.Serialization;

namespace CertAgent.Worker.Models;

/// <summary>
/// Request body for POST /runs/{runId}/complete — matches agentRunStatusSchema.
/// </summary>
public sealed class CompleteRequest
{
    [JsonPropertyName("leaseId")]
    public string LeaseId { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; set; } = "completed";

    [JsonPropertyName("logs")]
    public string? Logs { get; set; }

    [JsonPropertyName("errorMessage")]
    public string? ErrorMessage { get; set; }

    [JsonPropertyName("errorCode")]
    public string? ErrorCode { get; set; }

    [JsonPropertyName("resultMeta")]
    public ResultMeta? ResultMeta { get; set; }
}

/// <summary>
/// Response from POST /runs/{runId}/complete.
/// </summary>
public sealed class CompleteResponse
{
    [JsonPropertyName("ok")]
    public bool Ok { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }
}
