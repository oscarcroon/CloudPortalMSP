using System.Text;
using CertAgent.Worker.Configuration;
using CertAgent.Worker.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace CertAgent.Worker.Services;

/// <summary>
/// Buffered log shipping to portal + lease keepalive.
/// Accumulates stdout/stderr lines and flushes every N seconds.
/// Sends empty keepalive calls when no output is produced.
/// </summary>
public sealed class LogStreamingService : IDisposable
{
    private readonly PortalApiClient _apiClient;
    private readonly AgentBehaviorOptions _behaviorOptions;
    private readonly ILogger<LogStreamingService> _logger;

    private readonly StringBuilder _buffer = new();
    private readonly object _bufferLock = new();
    private int _sequence;
    private Timer? _flushTimer;
    private Timer? _keepaliveTimer;
    private DateTime _lastFlushWithContent = DateTime.UtcNow;

    private string? _runId;
    private string? _leaseId;
    private CancellationToken _ct;
    private bool _disposed;

    public LogStreamingService(
        PortalApiClient apiClient,
        IOptions<AgentBehaviorOptions> behaviorOptions,
        ILogger<LogStreamingService> logger)
    {
        _apiClient = apiClient;
        _behaviorOptions = behaviorOptions.Value;
        _logger = logger;
    }

    /// <summary>
    /// Start the log streaming service for a specific run.
    /// </summary>
    public void Start(string runId, string leaseId, CancellationToken ct)
    {
        _runId = runId;
        _leaseId = leaseId;
        _ct = ct;
        _sequence = 0;
        _lastFlushWithContent = DateTime.UtcNow;

        var flushInterval = TimeSpan.FromSeconds(_behaviorOptions.LogFlushIntervalSeconds);
        _flushTimer = new Timer(FlushCallback, null, flushInterval, flushInterval);

        var keepaliveInterval = TimeSpan.FromSeconds(_behaviorOptions.LeaseKeepaliveIntervalSeconds);
        _keepaliveTimer = new Timer(KeepaliveCallback, null, keepaliveInterval, keepaliveInterval);
    }

    /// <summary>
    /// Append a log line to the buffer. Thread-safe.
    /// </summary>
    public void AppendLine(string line)
    {
        lock (_bufferLock)
        {
            _buffer.AppendLine(line);
        }
    }

    /// <summary>
    /// Flush remaining buffered logs and stop timers.
    /// </summary>
    public async Task FlushAndStopAsync()
    {
        _flushTimer?.Change(Timeout.Infinite, Timeout.Infinite);
        _keepaliveTimer?.Change(Timeout.Infinite, Timeout.Infinite);

        await FlushBufferAsync();
    }

    /// <summary>
    /// Get any remaining unflushed log content (for inclusion in complete request).
    /// </summary>
    public string DrainRemainingLogs()
    {
        lock (_bufferLock)
        {
            var remaining = _buffer.ToString();
            _buffer.Clear();
            return remaining;
        }
    }

    private async void FlushCallback(object? state)
    {
        try
        {
            await FlushBufferAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error flushing log buffer");
        }
    }

    private async void KeepaliveCallback(object? state)
    {
        try
        {
            var timeSinceLastContent = DateTime.UtcNow - _lastFlushWithContent;
            var keepaliveThreshold = TimeSpan.FromSeconds(_behaviorOptions.LeaseKeepaliveIntervalSeconds);

            if (timeSinceLastContent >= keepaliveThreshold)
            {
                // No log output since last flush — send empty keepalive to extend lease
                await SendStatusAsync(null);
                _logger.LogDebug("Sent lease keepalive for run {RunId}", _runId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error sending keepalive");
        }
    }

    private async Task FlushBufferAsync()
    {
        string? logs;
        lock (_bufferLock)
        {
            if (_buffer.Length == 0) return;
            logs = _buffer.ToString();
            _buffer.Clear();
        }

        if (!string.IsNullOrEmpty(logs))
        {
            await SendStatusAsync(logs);
            _lastFlushWithContent = DateTime.UtcNow;
        }
    }

    private async Task SendStatusAsync(string? logs)
    {
        if (string.IsNullOrEmpty(_runId) || string.IsNullOrEmpty(_leaseId)) return;

        var seq = Interlocked.Increment(ref _sequence);
        var request = new StatusRequest
        {
            LeaseId = _leaseId,
            Logs = logs,
            Sequence = seq
        };

        try
        {
            await _apiClient.SendStatusAsync(_runId, request, _ct);
        }
        catch (OperationCanceledException)
        {
            // Shutdown — acceptable
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send status for run {RunId} (seq={Seq})", _runId, seq);
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _flushTimer?.Dispose();
        _keepaliveTimer?.Dispose();
    }
}
