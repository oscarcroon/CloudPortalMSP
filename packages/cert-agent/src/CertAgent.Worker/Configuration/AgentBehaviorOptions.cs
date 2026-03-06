namespace CertAgent.Worker.Configuration;

public sealed class AgentBehaviorOptions
{
    public const string SectionName = "AgentBehavior";

    public int WorkPollIntervalSeconds { get; set; } = 30;
    public int HeartbeatIntervalSeconds { get; set; } = 60;
    public int LogFlushIntervalSeconds { get; set; } = 5;
    public int LeaseKeepaliveIntervalSeconds { get; set; } = 30;
    public int MaxConsecutiveApiFailures { get; set; } = 10;
}
