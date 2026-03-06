using Xunit;
using CertAgent.Worker.Helpers;

namespace CertAgent.Tests.Helpers;

public class LogRedactorTests
{
    [Fact]
    public void Redact_EabKey_IsRedacted()
    {
        var input = "Using --eab-key dGhpc2lzYXNlY3JldA== for registration";
        var result = LogRedactor.Redact(input);

        Assert.Contains("--eab-key [REDACTED]", result);
        Assert.DoesNotContain("dGhpc2lzYXNlY3JldA==", result);
    }

    [Fact]
    public void Redact_EabKeyIdentifier_IsRedacted()
    {
        var input = "--eab-key-identifier kid-abc123 --other-flag";
        var result = LogRedactor.Redact(input);

        Assert.Contains("--eab-key-identifier [REDACTED]", result);
        Assert.DoesNotContain("kid-abc123", result);
    }

    [Fact]
    public void Redact_PrivateKey_IsRedacted()
    {
        var input = "-----BEGIN PRIVATE KEY-----";
        var result = LogRedactor.Redact(input);

        Assert.Contains("[REDACTED]", result);
        Assert.DoesNotContain("PRIVATE KEY", result);
    }

    [Fact]
    public void Redact_BearerToken_IsRedacted()
    {
        var input = "Authorization: Bearer msp_agent.abc.secret123";
        var result = LogRedactor.Redact(input);

        Assert.Contains("Authorization: Bearer [REDACTED]", result);
        Assert.DoesNotContain("msp_agent.abc.secret123", result);
    }

    [Fact]
    public void Redact_Password_IsRedacted()
    {
        var input = "password=supersecret";
        var result = LogRedactor.Redact(input);

        Assert.Contains("password=[REDACTED]", result);
        Assert.DoesNotContain("supersecret", result);
    }

    [Fact]
    public void Redact_PasswordWithColon_IsRedacted()
    {
        var input = "password: mysecret123";
        var result = LogRedactor.Redact(input);

        Assert.Contains("password=[REDACTED]", result);
        Assert.DoesNotContain("mysecret123", result);
    }

    [Fact]
    public void Redact_PfxPassword_IsRedacted()
    {
        var input = "--pfxpassword myP@ssw0rd --other-flag";
        var result = LogRedactor.Redact(input);

        Assert.Contains("--pfxpassword [REDACTED]", result);
        Assert.DoesNotContain("myP@ssw0rd", result);
    }

    [Fact]
    public void Redact_KeyFlag_IsRedacted()
    {
        var input = "--key some-api-key-value --next-flag";
        var result = LogRedactor.Redact(input);

        Assert.Contains("--key [REDACTED]", result);
        Assert.DoesNotContain("some-api-key-value", result);
    }

    [Fact]
    public void Redact_NoSensitiveData_Unchanged()
    {
        var input = "Certificate issued successfully for example.com";
        var result = LogRedactor.Redact(input);

        Assert.Equal(input, result);
    }

    [Fact]
    public void Redact_EmptyString_ReturnsEmpty()
    {
        Assert.Equal("", LogRedactor.Redact(""));
    }

    [Fact]
    public void Redact_NullString_ReturnsNull()
    {
        Assert.Null(LogRedactor.Redact(null!));
    }

    [Fact]
    public void Redact_MultiplePatterns_AllRedacted()
    {
        var input = "--eab-key secret123 --pfxpassword pass456 password=hidden";
        var result = LogRedactor.Redact(input);

        Assert.DoesNotContain("secret123", result);
        Assert.DoesNotContain("pass456", result);
        Assert.DoesNotContain("hidden", result);
    }

    [Fact]
    public void Redact_DynamicPattern_IsRedacted()
    {
        LogRedactor.AddDynamicPattern(@"C:\temp\secret-12345.tmp", "[SECRET_FILE]");
        try
        {
            var input = @"Writing to C:\temp\secret-12345.tmp";
            var result = LogRedactor.Redact(input);

            Assert.Contains("[SECRET_FILE]", result);
            Assert.DoesNotContain("secret-12345", result);
        }
        finally
        {
            LogRedactor.ClearDynamicPatterns();
        }
    }

    [Fact]
    public void ClearDynamicPatterns_RemovesPatterns()
    {
        LogRedactor.AddDynamicPattern("tempfile123", "[REMOVED]");
        LogRedactor.ClearDynamicPatterns();

        var input = "Using tempfile123 for storage";
        var result = LogRedactor.Redact(input);

        Assert.Contains("tempfile123", result);
    }

    [Fact]
    public void Redact_CaseInsensitive_Matches()
    {
        var input = "AUTHORIZATION: BEARER token123";
        var result = LogRedactor.Redact(input);

        Assert.DoesNotContain("token123", result);
    }
}
