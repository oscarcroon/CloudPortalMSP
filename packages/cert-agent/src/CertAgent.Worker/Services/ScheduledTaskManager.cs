using System.Runtime.InteropServices;
using Microsoft.Extensions.Logging;
using Microsoft.Win32.TaskScheduler;

namespace CertAgent.Worker.Services;

/// <summary>
/// Manages simple-acme renewal scheduled tasks via COM API (Task Scheduler 1.1).
/// Reports task status for heartbeats and verifies renewal tasks exist after successful runs.
/// </summary>
public sealed class ScheduledTaskManager
{
    private const string SimpleAcmeTaskFolder = "simple-acme";
    private readonly ILogger<ScheduledTaskManager> _logger;

    public ScheduledTaskManager(ILogger<ScheduledTaskManager> logger)
    {
        _logger = logger;
    }

    public sealed class ScheduledTaskInfo
    {
        public string? TaskName { get; init; }
        public string? Status { get; init; }
        public DateTime? LastRunTime { get; init; }
        public DateTime? NextRunTime { get; init; }
    }

    /// <summary>
    /// Get the status of simple-acme renewal scheduled task(s) for heartbeat reporting.
    /// </summary>
    public ScheduledTaskInfo? GetRenewalTaskStatus()
    {
        try
        {
            using var ts = new TaskService();
            var folder = GetOrCreateFolder(ts, SimpleAcmeTaskFolder);
            if (folder == null) return null;

            var tasks = folder.GetTasks();
            if (tasks.Count == 0) return null;

            // Return the first (primary) renewal task info
            var task = tasks[0];
            return new ScheduledTaskInfo
            {
                TaskName = task.Name,
                Status = task.State.ToString(),
                LastRunTime = task.LastRunTime == DateTime.MinValue ? null : task.LastRunTime,
                NextRunTime = task.NextRunTime == DateTime.MinValue ? null : task.NextRunTime
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query scheduled task status");
            return null;
        }
    }

    /// <summary>
    /// Count renewal configuration files in simple-acme config folder.
    /// </summary>
    public int CountRenewalConfigs(string configPath)
    {
        try
        {
            var renewalDir = Path.Combine(configPath, "Renewals");
            if (!Directory.Exists(renewalDir)) return 0;
            return Directory.GetFiles(renewalDir, "*.renewal.json").Length;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to count renewal configs");
            return 0;
        }
    }

    /// <summary>
    /// Verify that a renewal task exists for the given renewal name.
    /// simple-acme creates its own task when --notaskscheduler is not used.
    /// </summary>
    public bool VerifyRenewalTaskExists(string? renewalName)
    {
        if (string.IsNullOrEmpty(renewalName)) return false;

        try
        {
            using var ts = new TaskService();
            var folder = GetOrCreateFolder(ts, SimpleAcmeTaskFolder);
            if (folder == null) return false;

            foreach (var task in folder.GetTasks())
            {
                if (task.Name.Contains(renewalName, StringComparison.OrdinalIgnoreCase))
                    return true;
            }

            return false;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to verify renewal task for {Name}", renewalName);
            return false;
        }
    }

    private static TaskFolder? GetOrCreateFolder(TaskService ts, string folderName)
    {
        try
        {
            return ts.GetFolder($"\\{folderName}");
        }
        catch
        {
            return null;
        }
    }
}
