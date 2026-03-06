using System.Text.Json.Serialization;

namespace CertAgent.Worker.Models;

/// <summary>
/// Request body for POST /heartbeat — matches agentHeartbeatSchema + capabilities.
/// </summary>
public sealed class HeartbeatRequest
{
    [JsonPropertyName("simpleAcmeVersion")]
    public string? SimpleAcmeVersion { get; set; }

    [JsonPropertyName("renewalTaskStatus")]
    public string? RenewalTaskStatus { get; set; }

    [JsonPropertyName("renewalCount")]
    public int? RenewalCount { get; set; }

    [JsonPropertyName("os")]
    public string? Os { get; set; }

    [JsonPropertyName("hostname")]
    public string? Hostname { get; set; }

    [JsonPropertyName("capabilities")]
    public AgentCapabilities? Capabilities { get; set; }
}

public sealed class AgentCapabilities
{
    [JsonPropertyName("supports")]
    public List<string> Supports { get; set; } = [];

    [JsonPropertyName("dnsProviders")]
    public List<string> DnsProviders { get; set; } = [];
}
