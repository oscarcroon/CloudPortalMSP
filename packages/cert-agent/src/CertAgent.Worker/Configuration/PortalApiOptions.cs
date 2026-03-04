namespace CertAgent.Worker.Configuration;

public sealed class PortalApiOptions
{
    public const string SectionName = "PortalApi";

    public string BaseUrl { get; set; } = "https://portal.example.com";
    public string AgentToken { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; } = 30;

    /// <summary>
    /// Base URL for agent-api endpoints. Constructed from BaseUrl.
    /// </summary>
    public string AgentApiBaseUrl => BaseUrl.TrimEnd('/') + "/api/certificates/agent-api";
}
