using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CertAgent.Worker.Configuration;
using CertAgent.Worker.Helpers;
using CertAgent.Worker.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace CertAgent.Worker.Services;

/// <summary>
/// HTTP client for the 4 portal agent-api endpoints.
/// Uses IHttpClientFactory with named client + Bearer token auth.
/// </summary>
public sealed class PortalApiClient
{
    public const string HttpClientName = "PortalApi";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<PortalApiClient> _logger;
    private readonly PortalApiOptions _options;
    private int _consecutiveFailures;

    public int ConsecutiveFailures => _consecutiveFailures;

    /// <summary>
    /// The portal base URL (without /api/certificates/agent-api/ suffix).
    /// Used by DnsChallengeScriptGenerator to build the challenge endpoint URL.
    /// </summary>
    public string PortalBaseUrl
    {
        get
        {
            // AgentApiBaseUrl is e.g. "https://portal.example.com/api/certificates/agent-api"
            // Strip the agent-api path to get the portal base
            var url = _options.AgentApiBaseUrl.TrimEnd('/');
            const string suffix = "/api/certificates/agent-api";
            if (url.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
                return url[..^suffix.Length];
            return url;
        }
    }

    public PortalApiClient(
        IHttpClientFactory httpClientFactory,
        IOptions<PortalApiOptions> options,
        ILogger<PortalApiClient> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    /// <summary>
    /// GET /work — poll for pending work. Returns null on 204 (no work).
    /// </summary>
    public async Task<WorkResponse?> PollForWorkAsync(CancellationToken ct = default)
    {
        return await ExecuteWithRetryAsync(async () =>
        {
            var client = CreateClient();
            var response = await client.GetAsync("work", ct);

            if (response.StatusCode == HttpStatusCode.NoContent)
                return null;

            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<WorkResponse>(JsonOptions, ct);
        }, "GET /work", retryable: true, ct: ct);
    }

    /// <summary>
    /// POST /runs/{runId}/status — send logs + extend lease.
    /// </summary>
    public async Task<StatusResponse?> SendStatusAsync(string runId, StatusRequest request, CancellationToken ct = default)
    {
        return await ExecuteWithRetryAsync(async () =>
        {
            var client = CreateClient();
            var response = await client.PostAsJsonAsync($"runs/{runId}/status", request, JsonOptions, ct);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<StatusResponse>(JsonOptions, ct);
        }, $"POST /runs/{runId}/status", retryable: true, ct: ct);
    }

    /// <summary>
    /// POST /runs/{runId}/complete — report final status (idempotent via leaseId).
    /// </summary>
    public async Task<CompleteResponse?> CompleteRunAsync(string runId, CompleteRequest request, CancellationToken ct = default)
    {
        return await ExecuteWithRetryAsync(async () =>
        {
            var client = CreateClient();
            var response = await client.PostAsJsonAsync($"runs/{runId}/complete", request, JsonOptions, ct);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<CompleteResponse>(JsonOptions, ct);
        }, $"POST /runs/{runId}/complete", retryable: true, ct: ct);
    }

    /// <summary>
    /// POST /heartbeat — send agent status info.
    /// </summary>
    public async Task SendHeartbeatAsync(HeartbeatRequest request, CancellationToken ct = default)
    {
        await ExecuteWithRetryAsync(async () =>
        {
            var client = CreateClient();
            var response = await client.PostAsJsonAsync("heartbeat", request, JsonOptions, ct);
            response.EnsureSuccessStatusCode();
            return true;
        }, "POST /heartbeat", retryable: true, ct: ct);
    }

    private HttpClient CreateClient()
    {
        var client = _httpClientFactory.CreateClient(HttpClientName);
        return client;
    }

    private async Task<T?> ExecuteWithRetryAsync<T>(
        Func<Task<T?>> action,
        string operationName,
        bool retryable,
        CancellationToken ct,
        int maxRetries = 3)
    {
        for (var attempt = 0; attempt <= maxRetries; attempt++)
        {
            try
            {
                var result = await action();
                Interlocked.Exchange(ref _consecutiveFailures, 0);
                return result;
            }
            catch (HttpRequestException ex) when (
                retryable
                && attempt < maxRetries
                && ex.StatusCode.HasValue
                && RetryPolicies.IsRetryableStatusCode(ex.StatusCode.Value))
            {
                var delay = RetryPolicies.GetRetryDelay(attempt);
                _logger.LogWarning(
                    "{Operation} failed with {StatusCode}, retry {Attempt}/{Max} in {Delay:F1}s",
                    operationName, ex.StatusCode, attempt + 1, maxRetries, delay.TotalSeconds);
                await Task.Delay(delay, ct);
            }
            catch (HttpRequestException ex) when (
                ex.StatusCode == HttpStatusCode.Unauthorized
                || ex.StatusCode == HttpStatusCode.Forbidden)
            {
                Interlocked.Increment(ref _consecutiveFailures);
                _logger.LogError("{Operation} authentication failed ({StatusCode}). Check AgentToken.", operationName, ex.StatusCode);
                throw;
            }
            catch (TaskCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                Interlocked.Increment(ref _consecutiveFailures);
                if (attempt >= maxRetries || !retryable)
                {
                    _logger.LogError(ex, "{Operation} failed after {Attempts} attempts", operationName, attempt + 1);
                    throw;
                }
                var delay = RetryPolicies.GetRetryDelay(attempt);
                _logger.LogWarning(ex, "{Operation} failed, retry {Attempt}/{Max} in {Delay:F1}s",
                    operationName, attempt + 1, maxRetries, delay.TotalSeconds);
                await Task.Delay(delay, ct);
            }
        }

        return default;
    }

    /// <summary>
    /// Configure the named HttpClient in DI.
    /// </summary>
    public static void ConfigureHttpClient(HttpClient client, PortalApiOptions options)
    {
        client.BaseAddress = new Uri(options.AgentApiBaseUrl.TrimEnd('/') + "/");
        client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", options.AgentToken);
        client.DefaultRequestHeaders.Accept.Add(
            new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));
    }
}
