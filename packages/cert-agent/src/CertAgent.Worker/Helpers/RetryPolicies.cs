using System.Net;

namespace CertAgent.Worker.Helpers;

/// <summary>
/// Retry/resilience helpers for HTTP calls.
/// </summary>
public static class RetryPolicies
{
    /// <summary>
    /// Determines if an HTTP status code is retryable.
    /// 5xx and request timeout are retryable; 401/403 are not.
    /// </summary>
    public static bool IsRetryableStatusCode(HttpStatusCode statusCode)
    {
        return statusCode >= HttpStatusCode.InternalServerError
            || statusCode == HttpStatusCode.RequestTimeout
            || statusCode == HttpStatusCode.TooManyRequests;
    }

    /// <summary>
    /// Get retry delay with exponential backoff + jitter.
    /// </summary>
    public static TimeSpan GetRetryDelay(int attempt, int maxDelaySeconds = 60)
    {
        var baseDelay = Math.Pow(2, attempt);
        var jitter = Random.Shared.NextDouble() * 0.5;
        var totalSeconds = Math.Min(baseDelay + jitter, maxDelaySeconds);
        return TimeSpan.FromSeconds(totalSeconds);
    }
}
