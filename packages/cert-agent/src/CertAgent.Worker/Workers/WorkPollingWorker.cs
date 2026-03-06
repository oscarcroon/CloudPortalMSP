using CertAgent.Worker.Configuration;
using CertAgent.Worker.Helpers;
using CertAgent.Worker.Models;
using CertAgent.Worker.Services;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace CertAgent.Worker.Workers;

/// <summary>
/// Main work loop: polls for work, executes simple-acme, streams logs, reports completion.
/// Uses SemaphoreSlim(1,1) to ensure only one run at a time.
/// </summary>
public sealed class WorkPollingWorker : BackgroundService
{
    private readonly PortalApiClient _apiClient;
    private readonly SimpleAcmeExecutor _executor;
    private readonly CertificateMetadataReader _metadataReader;
    private readonly IServiceProvider _serviceProvider;
    private readonly AgentBehaviorOptions _behaviorOptions;
    private readonly SimpleAcmeOptions _simpleAcmeOptions;
    private readonly ILogger<WorkPollingWorker> _logger;
    private readonly SemaphoreSlim _runLock = new(1, 1);

    public WorkPollingWorker(
        PortalApiClient apiClient,
        SimpleAcmeExecutor executor,
        CertificateMetadataReader metadataReader,
        IServiceProvider serviceProvider,
        IOptions<AgentBehaviorOptions> behaviorOptions,
        IOptions<SimpleAcmeOptions> simpleAcmeOptions,
        ILogger<WorkPollingWorker> logger)
    {
        _apiClient = apiClient;
        _executor = executor;
        _metadataReader = metadataReader;
        _serviceProvider = serviceProvider;
        _behaviorOptions = behaviorOptions.Value;
        _simpleAcmeOptions = simpleAcmeOptions.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("WorkPollingWorker started — polling every {Interval}s",
            _behaviorOptions.WorkPollIntervalSeconds);

        var pollInterval = TimeSpan.FromSeconds(_behaviorOptions.WorkPollIntervalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Skip polling if a run is active
                if (_runLock.CurrentCount == 0)
                {
                    await Task.Delay(pollInterval, stoppingToken);
                    continue;
                }

                // Check consecutive failures circuit breaker
                if (_apiClient.ConsecutiveFailures >= _behaviorOptions.MaxConsecutiveApiFailures)
                {
                    _logger.LogError("Too many consecutive API failures ({Count}) — backing off",
                        _apiClient.ConsecutiveFailures);
                    await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
                    continue;
                }

                var work = await _apiClient.PollForWorkAsync(stoppingToken);

                if (work?.Payload == null)
                {
                    await Task.Delay(pollInterval, stoppingToken);
                    continue;
                }

                _logger.LogInformation("Received work: RunId={RunId}, Domain={Domain}",
                    work.RunId, work.Payload.PrimaryDomain);

                // Process the run (non-blocking to the poll loop — it acquires the lock)
                _ = ProcessRunAsync(work, stoppingToken);

                // Wait before next poll
                await Task.Delay(pollInterval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (HttpRequestException ex) when (
                ex.StatusCode == System.Net.HttpStatusCode.Unauthorized
                || ex.StatusCode == System.Net.HttpStatusCode.Forbidden)
            {
                _logger.LogError("Authentication failed — check PortalApi:AgentToken. Waiting 60s before retry.");
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in work polling loop");
                await Task.Delay(pollInterval, stoppingToken);
            }
        }

        _logger.LogInformation("WorkPollingWorker stopping");
    }

    private async Task ProcessRunAsync(WorkResponse work, CancellationToken stoppingToken)
    {
        if (!await _runLock.WaitAsync(0))
        {
            _logger.LogWarning("Run lock already held — skipping work {RunId}", work.RunId);
            return;
        }

        // Create a scoped LogStreamingService
        var logStreaming = _serviceProvider.GetRequiredService<LogStreamingService>();
        string? secretFilePath = null;
        DnsChallengeFiles? dnsFiles = null;

        try
        {
            LogRedactor.ClearDynamicPatterns();

            var payload = work.Payload!;
            var runId = work.RunId;
            var leaseId = work.LeaseId;

            // Start log streaming
            logStreaming.Start(runId, leaseId, stoppingToken);

            // Write EAB HMAC to temp file if needed
            if (!string.IsNullOrEmpty(payload.Credential.EabHmac))
            {
                secretFilePath = SecretFileHelper.WriteSecretToTempFile(payload.Credential.EabHmac);
            }

            // Generate DNS challenge scripts if portal returned a challenge token
            if (!string.IsNullOrEmpty(work.DnsChallengeToken))
            {
                dnsFiles = DnsChallengeScriptGenerator.Generate(
                    _apiClient.PortalBaseUrl, work.DnsChallengeToken);
                payload.ValidationMeta ??= new Dictionary<string, object>();
                payload.ValidationMeta["dnsCreateScript"] = dnsFiles.CreateScriptPath;
                payload.ValidationMeta["dnsDeleteScript"] = dnsFiles.DeleteScriptPath;
            }

            // Build CLI arguments
            var profile = new DefaultCommandProfile(_simpleAcmeOptions.Verbose);
            var arguments = profile.BuildArgs(payload, secretFilePath);

            // Execute simple-acme
            var result = await _executor.ExecuteAsync(
                arguments,
                line => logStreaming.AppendLine(line),
                stoppingToken);

            // Flush remaining logs
            await logStreaming.FlushAndStopAsync();
            var remainingLogs = logStreaming.DrainRemainingLogs();

            if (result.ExitCode == 0 && !result.TimedOut)
            {
                // Success — read certificate metadata
                var meta = _metadataReader.ReadMetadata(payload);

                _logger.LogInformation("Run {RunId} completed successfully. Thumbprint={Thumbprint}",
                    runId, meta?.Thumbprint);

                await _apiClient.CompleteRunAsync(runId, new CompleteRequest
                {
                    LeaseId = leaseId,
                    Status = "completed",
                    Logs = string.IsNullOrEmpty(remainingLogs) ? null : remainingLogs,
                    ResultMeta = meta
                }, stoppingToken);
            }
            else
            {
                // Failure
                var errorMessage = result.TimedOut
                    ? $"simple-acme timed out after {_simpleAcmeOptions.HardTimeoutMinutes} minutes"
                    : $"simple-acme exited with code {result.ExitCode}";
                var errorCode = result.TimedOut ? "TIMEOUT" : $"EXIT_{result.ExitCode}";

                _logger.LogWarning("Run {RunId} failed: {Error}", runId, errorMessage);

                await _apiClient.CompleteRunAsync(runId, new CompleteRequest
                {
                    LeaseId = leaseId,
                    Status = "failed",
                    Logs = string.IsNullOrEmpty(remainingLogs) ? null : remainingLogs,
                    ErrorMessage = errorMessage,
                    ErrorCode = errorCode
                }, stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Graceful shutdown — report agent shutdown
            _logger.LogWarning("Shutdown during run {RunId} — reporting AGENT_SHUTDOWN", work.RunId);
            try
            {
                await logStreaming.FlushAndStopAsync();
                var remainingLogs = logStreaming.DrainRemainingLogs();

                using var shutdownCts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
                await _apiClient.CompleteRunAsync(work.RunId, new CompleteRequest
                {
                    LeaseId = work.LeaseId,
                    Status = "failed",
                    Logs = string.IsNullOrEmpty(remainingLogs) ? null : remainingLogs,
                    ErrorMessage = "Agent shutdown during execution",
                    ErrorCode = "AGENT_SHUTDOWN"
                }, shutdownCts.Token);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to report shutdown for run {RunId}", work.RunId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error processing run {RunId}", work.RunId);

            try
            {
                await logStreaming.FlushAndStopAsync();
                var remainingLogs = logStreaming.DrainRemainingLogs();

                await _apiClient.CompleteRunAsync(work.RunId, new CompleteRequest
                {
                    LeaseId = work.LeaseId,
                    Status = "failed",
                    Logs = string.IsNullOrEmpty(remainingLogs) ? null : remainingLogs,
                    ErrorMessage = $"Agent error: {ex.Message}",
                    ErrorCode = "AGENT_ERROR"
                }, CancellationToken.None);
            }
            catch (Exception reportEx)
            {
                _logger.LogWarning(reportEx, "Failed to report error for run {RunId}", work.RunId);
            }
        }
        finally
        {
            DnsChallengeScriptGenerator.Cleanup(dnsFiles);
            SecretFileHelper.DeleteSecretFile(secretFilePath);
            LogRedactor.ClearDynamicPatterns();
            logStreaming.Dispose();
            _runLock.Release();
        }
    }
}
