using CertAgent.Worker.Models;

namespace CertAgent.Worker.Helpers;

/// <summary>
/// Version-aware CLI dialect for simple-acme (wacs.exe).
/// Sprint 1 targets a single known version profile.
/// Add new implementations for future versions with different flags.
/// </summary>
public interface ICommandProfile
{
    string BuildArgs(RunPayload payload, string? secretFilePath);
}

/// <summary>
/// Default profile for simple-acme v2.2+.
/// </summary>
public sealed class DefaultCommandProfile : ICommandProfile
{
    private readonly bool _verbose;

    public DefaultCommandProfile(bool verbose = false)
    {
        _verbose = verbose;
    }

    public string BuildArgs(RunPayload payload, string? secretFilePath)
    {
        return SimpleAcmeCommandBuilder.Build(payload, secretFilePath, _verbose);
    }
}
