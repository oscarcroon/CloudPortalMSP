using System.Text.RegularExpressions;

namespace CertAgent.Worker.Helpers;

/// <summary>
/// Client-side log redaction — defense in depth before sending to portal.
/// Mirrors portal LOG_REDACT_PATTERNS + agent-specific extras.
/// </summary>
public static class LogRedactor
{
    private static readonly (Regex Pattern, string Replacement)[] RedactRules =
    [
        (new Regex(@"--eab-key\s+\S+", RegexOptions.IgnoreCase | RegexOptions.Compiled), "--eab-key [REDACTED]"),
        (new Regex(@"--eab-key-identifier\s+\S+", RegexOptions.IgnoreCase | RegexOptions.Compiled), "--eab-key-identifier [REDACTED]"),
        (new Regex(@"PRIVATE KEY", RegexOptions.IgnoreCase | RegexOptions.Compiled), "[REDACTED]"),
        (new Regex(@"Authorization:\s*Bearer\s+\S+", RegexOptions.IgnoreCase | RegexOptions.Compiled), "Authorization: Bearer [REDACTED]"),
        (new Regex(@"password\s*[:=]\s*\S+", RegexOptions.IgnoreCase | RegexOptions.Compiled), "password=[REDACTED]"),
        (new Regex(@"--pfxpassword\s+\S+", RegexOptions.IgnoreCase | RegexOptions.Compiled), "--pfxpassword [REDACTED]"),
        (new Regex(@"--key\s+\S+", RegexOptions.IgnoreCase | RegexOptions.Compiled), "--key [REDACTED]"),
    ];

    /// <summary>
    /// Additional patterns added at runtime (e.g., temp file paths containing secrets).
    /// </summary>
    private static readonly List<(Regex Pattern, string Replacement)> _dynamicRules = [];

    /// <summary>
    /// Register a dynamic redaction pattern (e.g., for temp secret file paths).
    /// </summary>
    public static void AddDynamicPattern(string literalToRedact, string replacement = "[REDACTED]")
    {
        if (string.IsNullOrEmpty(literalToRedact)) return;
        var escaped = Regex.Escape(literalToRedact);
        lock (_dynamicRules)
        {
            _dynamicRules.Add((new Regex(escaped, RegexOptions.IgnoreCase | RegexOptions.Compiled), replacement));
        }
    }

    /// <summary>
    /// Clear all dynamic patterns (e.g., between runs).
    /// </summary>
    public static void ClearDynamicPatterns()
    {
        lock (_dynamicRules)
        {
            _dynamicRules.Clear();
        }
    }

    /// <summary>
    /// Redact sensitive data from a log line.
    /// </summary>
    public static string Redact(string input)
    {
        if (string.IsNullOrEmpty(input)) return input;

        var result = input;
        foreach (var (pattern, replacement) in RedactRules)
        {
            result = pattern.Replace(result, replacement);
        }

        lock (_dynamicRules)
        {
            foreach (var (pattern, replacement) in _dynamicRules)
            {
                result = pattern.Replace(result, replacement);
            }
        }

        return result;
    }
}
