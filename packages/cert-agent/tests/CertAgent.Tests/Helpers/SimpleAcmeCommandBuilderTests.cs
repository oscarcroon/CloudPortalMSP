using Xunit;
using CertAgent.Worker.Helpers;
using CertAgent.Worker.Models;

namespace CertAgent.Tests.Helpers;

public class SimpleAcmeCommandBuilderTests
{
    private static RunPayload CreateBasePayload() => new()
    {
        RunId = "run-1",
        OrderId = "order-1",
        PrimaryDomain = "example.com",
        SubjectAlternativeNames = ["www.example.com"],
        ValidationMethod = "http-01",
        InstallationTarget = "iis",
        AutoRenew = true,
        RenewalName = "example-cert",
        RenewDaysBefore = 30,
        Credential = new CredentialInfo
        {
            Provider = "letsencrypt",
            AcmeDirectoryUrl = "https://acme-v02.api.letsencrypt.org/directory"
        }
    };

    [Fact]
    public void Build_BasicHttpIis_IncludesRequiredFlags()
    {
        var payload = CreateBasePayload();
        var args = SimpleAcmeCommandBuilder.Build(payload, null);

        Assert.Contains("--source manual", args);
        Assert.Contains("--host example.com,www.example.com", args);
        Assert.Contains("--commonname example.com", args);
        Assert.Contains("--baseuri https://acme-v02.api.letsencrypt.org/directory", args);
        Assert.Contains("--accepttos", args);
        Assert.Contains("--friendlyname \"example-cert\"", args);
        Assert.Contains("--closeonfinish", args);
        Assert.Contains("--validation iis", args);
        Assert.Contains("--store certificatestore", args);
        Assert.Contains("--installation iis", args);
    }

    [Fact]
    public void Build_WithEab_IncludesEabFlags()
    {
        var payload = CreateBasePayload();
        payload.Credential.EabKid = "kid-123";
        payload.Credential.EabHmac = "secret-hmac";

        var args = SimpleAcmeCommandBuilder.Build(payload, @"C:\temp\secret.tmp");

        Assert.Contains("--eab-key-identifier kid-123", args);
        Assert.Contains(@"--eab-key @C:\temp\secret.tmp", args);
        // HMAC must NOT appear in args
        Assert.DoesNotContain("secret-hmac", args);
    }

    [Fact]
    public void Build_WithoutEab_NoEabFlags()
    {
        var payload = CreateBasePayload();
        var args = SimpleAcmeCommandBuilder.Build(payload, null);

        Assert.DoesNotContain("--eab-key", args);
        Assert.DoesNotContain("--eab-key-identifier", args);
    }

    [Fact]
    public void Build_HttpFilesystem_IncludesValidationPath()
    {
        var payload = CreateBasePayload();
        payload.ValidationMeta = new Dictionary<string, object>
        {
            ["httpMode"] = "filesystem",
            ["webroot"] = @"C:\inetpub\wwwroot"
        };

        var args = SimpleAcmeCommandBuilder.Build(payload, null);

        Assert.Contains("--validation filesystem", args);
        Assert.Contains(@"--validationpath ""C:\inetpub\wwwroot""", args);
    }

    [Fact]
    public void Build_HttpSelfhosting_UsesCorrectFlag()
    {
        var payload = CreateBasePayload();
        payload.ValidationMeta = new Dictionary<string, object>
        {
            ["httpMode"] = "selfhosting"
        };

        var args = SimpleAcmeCommandBuilder.Build(payload, null);

        Assert.Contains("--validation selfhosting", args);
    }

    [Fact]
    public void Build_Dns01Cloudflare_UsesCorrectFlag()
    {
        var payload = CreateBasePayload();
        payload.ValidationMethod = "dns-01";
        payload.ValidationMeta = new Dictionary<string, object>
        {
            ["dnsProvider"] = "cloudflare"
        };

        var args = SimpleAcmeCommandBuilder.Build(payload, null);

        Assert.Contains("--validation cloudflare", args);
    }

    [Fact]
    public void Build_Dns01Manual_UsesManualFlag()
    {
        var payload = CreateBasePayload();
        payload.ValidationMethod = "dns-01";
        payload.ValidationMeta = new Dictionary<string, object>
        {
            ["dnsProvider"] = "manual"
        };

        var args = SimpleAcmeCommandBuilder.Build(payload, null);

        Assert.Contains("--validation manual", args);
    }

    [Fact]
    public void Build_PfxTarget_IncludesPfxFlags()
    {
        var payload = CreateBasePayload();
        payload.InstallationTarget = "pfx";
        payload.InstallationMeta = new Dictionary<string, object>
        {
            ["outputPath"] = @"C:\certs\example.pfx",
            ["pfxPassword"] = "test123"
        };

        var args = SimpleAcmeCommandBuilder.Build(payload, null);

        Assert.Contains("--store pfxfile", args);
        Assert.Contains(@"--pfxfilepath ""C:\certs\example.pfx""", args);
        Assert.Contains(@"--pfxpassword ""test123""", args);
    }

    [Fact]
    public void Build_CentralSslTarget_IncludesStorePath()
    {
        var payload = CreateBasePayload();
        payload.InstallationTarget = "centralssl";
        payload.InstallationMeta = new Dictionary<string, object>
        {
            ["storePath"] = @"C:\CentralSSL"
        };

        var args = SimpleAcmeCommandBuilder.Build(payload, null);

        Assert.Contains("--store centralssl", args);
        Assert.Contains(@"--centralsslstore ""C:\CentralSSL""", args);
    }

    [Fact]
    public void Build_ManualTarget_UsesPemFiles()
    {
        var payload = CreateBasePayload();
        payload.InstallationTarget = "manual";
        payload.InstallationMeta = new Dictionary<string, object>
        {
            ["outputDir"] = @"C:\certs\pem"
        };

        var args = SimpleAcmeCommandBuilder.Build(payload, null);

        Assert.Contains("--store pemfiles", args);
        Assert.Contains(@"--pemfilespath ""C:\certs\pem""", args);
    }

    [Fact]
    public void Build_AutoRenewFalse_IncludesNoTaskScheduler()
    {
        var payload = CreateBasePayload();
        payload.AutoRenew = false;

        var args = SimpleAcmeCommandBuilder.Build(payload, null);

        Assert.Contains("--notaskscheduler", args);
    }

    [Fact]
    public void Build_AutoRenewTrue_NoTaskSchedulerFlag()
    {
        var payload = CreateBasePayload();
        payload.AutoRenew = true;

        var args = SimpleAcmeCommandBuilder.Build(payload, null);

        Assert.DoesNotContain("--notaskscheduler", args);
    }

    [Fact]
    public void Build_Verbose_IncludesVerboseFlag()
    {
        var payload = CreateBasePayload();
        var args = SimpleAcmeCommandBuilder.Build(payload, null, verbose: true);

        Assert.Contains("--verbose", args);
    }

    [Fact]
    public void Build_IisWithSiteId_IncludesSiteId()
    {
        var payload = CreateBasePayload();
        payload.InstallationMeta = new Dictionary<string, object>
        {
            ["siteId"] = "2"
        };

        var args = SimpleAcmeCommandBuilder.Build(payload, null);

        Assert.Contains("--installationsiteid 2", args);
    }

    [Fact]
    public void Build_DefaultHttpMode_FallsBackToIis()
    {
        var payload = CreateBasePayload();
        // No validationMeta — should default to IIS
        var args = SimpleAcmeCommandBuilder.Build(payload, null);

        Assert.Contains("--validation iis", args);
    }

    [Fact]
    public void Build_NoRenewalName_UsesPrimaryDomain()
    {
        var payload = CreateBasePayload();
        payload.RenewalName = null;

        var args = SimpleAcmeCommandBuilder.Build(payload, null);

        Assert.Contains("--friendlyname \"example.com\"", args);
    }
}
