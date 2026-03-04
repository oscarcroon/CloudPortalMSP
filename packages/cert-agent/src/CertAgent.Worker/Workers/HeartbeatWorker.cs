using System.Reflection;
using System.Runtime.InteropServices;
using CertAgent.Worker.Configuration;
using CertAgent.Worker.Models;
using CertAgent.Worker.Services;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace CertAgent.Worker.Workers;

/// <summary>
/// Independent heartbeat loop — sends agent status to portal periodically.
/// </summary>
public sealed class HeartbeatWorker : BackgroundService
{
    private readonly PortalApiClient _apiClient;
    private readonly SimpleAcmeExecutor _executor;
    private readonly ScheduledTaskManager _taskManager;
    private readonly AgentBehaviorOptions _behaviorOptions;
    private readonly SimpleAcmeOptions _simpleAcmeOptions;
    private readonly ILogger<HeartbeatWorker> _logger;

    private string? _cachedSimpleAcmeVersion;
    private DateTime _versionCacheExpiry = DateTime.MinValue;

    public HeartbeatWorker(
        PortalApiClient apiClient,
        SimpleAcmeExecutor executor,
        ScheduledTaskManager taskManager,
        IOptions<AgentBehaviorOptions> behaviorOptions,
        IOptions<SimpleAcmeOptions> simpleAcmeOptions,
        ILogger<HeartbeatWorker> logger)
    {
        _apiClient = apiClient;
        _executor = executor;
        _taskManager = taskManager;
        _behaviorOptions = behaviorOptions.Value;
        _simpleAcmeOptions = simpleAcmeOptions.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Short delay to let other services initialize
        await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

        _logger.LogInformation("HeartbeatWorker started — interval {Interval}s",
            _behaviorOptions.HeartbeatIntervalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var request = await BuildHeartbeatRequestAsync(stoppingToken);
                await _apiClient.SendHeartbeatAsync(request, stoppingToken);
                _logger.LogDebug("Heartbeat sent");
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (HttpRequestException ex) when (
                ex.StatusCode == System.Net.HttpStatusCode.Unauthorized
                || ex.StatusCode == System.Net.HttpStatusCode.Forbidden)
            {
                _logger.LogError("Heartbeat auth failed — check PortalApi:AgentToken");
                // Wait longer on auth failure
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
                continue;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Heartbeat failed");
            }

            await Task.Delay(TimeSpan.FromSeconds(_behaviorOptions.HeartbeatIntervalSeconds), stoppingToken);
        }

        _logger.LogInformation("HeartbeatWorker stopping");
    }

    private async Task<HeartbeatRequest> BuildHeartbeatRequestAsync(CancellationToken ct)
    {
        // Refresh cached version every 10 minutes
        if (DateTime.UtcNow > _versionCacheExpiry)
        {
            _cachedSimpleAcmeVersion = await _executor.GetVersionAsync(ct);
            _versionCacheExpiry = DateTime.UtcNow.AddMinutes(10);
        }

        var taskInfo = _taskManager.GetRenewalTaskStatus();
        var renewalCount = _taskManager.CountRenewalConfigs(_simpleAcmeOptions.ConfigPath);

        var agentVersion = Assembly.GetEntryAssembly()?.GetName().Version?.ToString() ?? "unknown";

        var os = $"{RuntimeInformation.OSDescription} ({RuntimeInformation.OSArchitecture})";

        // Build capabilities list
        var supports = new List<string> { "http-01" };
        if (File.Exists(_simpleAcmeOptions.ExecutablePath))
        {
            supports.AddRange(["iis", "pfx", "centralssl", "pemfiles"]);
        }

        return new HeartbeatRequest
        {
            SimpleAcmeVersion = _cachedSimpleAcmeVersion,
            RenewalTaskStatus = taskInfo?.Status,
            RenewalCount = renewalCount,
            Os = os,
            Hostname = Environment.MachineName,
            Capabilities = new AgentCapabilities
            {
                Supports = supports,
                DnsProviders = [] // Future: detect installed DNS plugins
            }
        };
    }
}
