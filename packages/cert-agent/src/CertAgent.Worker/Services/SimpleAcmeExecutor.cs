using System.Diagnostics;
using CertAgent.Worker.Configuration;
using CertAgent.Worker.Helpers;
using CertAgent.Worker.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace CertAgent.Worker.Services;

/// <summary>
/// Manages simple-acme (wacs.exe) process execution with output capture,
/// soft/hard timeouts, and graceful shutdown.
/// </summary>
public sealed class SimpleAcmeExecutor
{
    private readonly SimpleAcmeOptions _options;
    private readonly ILogger<SimpleAcmeExecutor> _logger;
    private Process? _currentProcess;
    private readonly object _processLock = new();

    public SimpleAcmeExecutor(IOptions<SimpleAcmeOptions> options, ILogger<SimpleAcmeExecutor> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    /// <summary>
    /// Result of a simple-acme execution.
    /// </summary>
    public sealed class ExecutionResult
    {
        public int ExitCode { get; init; }
        public bool TimedOut { get; init; }
        public bool WasKilled { get; init; }
    }

    /// <summary>
    /// Execute wacs.exe with the given arguments. stdout/stderr lines are sent to onOutput.
    /// </summary>
    public async Task<ExecutionResult> ExecuteAsync(
        string arguments,
        Action<string> onOutput,
        CancellationToken ct)
    {
        if (!File.Exists(_options.ExecutablePath))
        {
            _logger.LogError("simple-acme not found at {Path}", _options.ExecutablePath);
            throw new FileNotFoundException($"simple-acme not found at {_options.ExecutablePath}");
        }

        var psi = new ProcessStartInfo
        {
            FileName = _options.ExecutablePath,
            Arguments = arguments,
            WorkingDirectory = _options.ConfigPath,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        var softTimeout = TimeSpan.FromMinutes(_options.SoftTimeoutMinutes);
        var hardTimeout = TimeSpan.FromMinutes(_options.HardTimeoutMinutes);

        using var process = new Process { StartInfo = psi, EnableRaisingEvents = true };
        var tcs = new TaskCompletionSource<int>();

        process.Exited += (_, _) =>
        {
            try { tcs.TrySetResult(process.ExitCode); }
            catch { tcs.TrySetResult(-1); }
        };

        process.OutputDataReceived += (_, e) =>
        {
            if (e.Data != null)
            {
                var redacted = LogRedactor.Redact(e.Data);
                onOutput(redacted);
            }
        };

        process.ErrorDataReceived += (_, e) =>
        {
            if (e.Data != null)
            {
                var redacted = LogRedactor.Redact($"[stderr] {e.Data}");
                onOutput(redacted);
            }
        };

        lock (_processLock)
        {
            _currentProcess = process;
        }

        try
        {
            _logger.LogInformation("Starting simple-acme: {Path} {Args}", _options.ExecutablePath,
                LogRedactor.Redact(arguments));
            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            var softCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            softCts.CancelAfter(softTimeout);

            var hardCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            hardCts.CancelAfter(hardTimeout);

            // Wait for exit with soft timeout awareness
            var softTimedOut = false;
            var hardTimedOut = false;

            try
            {
                await tcs.Task.WaitAsync(softCts.Token);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                softTimedOut = true;
                _logger.LogWarning("simple-acme soft timeout ({Minutes}min) reached — still running (may be waiting for DNS propagation)",
                    _options.SoftTimeoutMinutes);

                // Continue waiting up to hard timeout
                try
                {
                    await tcs.Task.WaitAsync(hardCts.Token);
                }
                catch (OperationCanceledException) when (!ct.IsCancellationRequested)
                {
                    hardTimedOut = true;
                    _logger.LogError("simple-acme hard timeout ({Minutes}min) reached — killing process", _options.HardTimeoutMinutes);
                    KillProcess(process);
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                // Service shutdown
                _logger.LogWarning("Cancellation requested — killing simple-acme process");
                KillProcess(process);
                throw;
            }

            var exitCode = tcs.Task.IsCompletedSuccessfully ? tcs.Task.Result : -1;

            _logger.LogInformation("simple-acme exited with code {ExitCode} (softTimeout={SoftTimedOut}, hardTimeout={HardTimedOut})",
                exitCode, softTimedOut, hardTimedOut);

            return new ExecutionResult
            {
                ExitCode = exitCode,
                TimedOut = hardTimedOut,
                WasKilled = hardTimedOut
            };
        }
        finally
        {
            lock (_processLock)
            {
                _currentProcess = null;
            }
        }
    }

    /// <summary>
    /// Get the simple-acme version string. Cached for caller to manage refresh.
    /// </summary>
    public async Task<string?> GetVersionAsync(CancellationToken ct = default)
    {
        if (!File.Exists(_options.ExecutablePath))
            return null;

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = _options.ExecutablePath,
                Arguments = "--version",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };

            using var process = Process.Start(psi);
            if (process == null) return null;

            var output = await process.StandardOutput.ReadToEndAsync(ct);
            await process.WaitForExitAsync(ct);

            return output.Trim();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get simple-acme version");
            return null;
        }
    }

    /// <summary>
    /// Kill the currently running process (for graceful shutdown).
    /// </summary>
    public void KillCurrentProcess()
    {
        lock (_processLock)
        {
            if (_currentProcess != null)
            {
                KillProcess(_currentProcess);
            }
        }
    }

    private void KillProcess(Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
                _logger.LogWarning("Killed simple-acme process tree (PID={Pid})", process.Id);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error killing simple-acme process");
        }
    }
}
