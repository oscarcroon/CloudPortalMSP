namespace CertAgent.Worker.Configuration;

public sealed class SimpleAcmeOptions
{
    public const string SectionName = "SimpleAcme";

    public string ExecutablePath { get; set; } = @"C:\simple-acme\wacs.exe";
    public string ConfigPath { get; set; } = @"C:\simple-acme";
    public string MinVersion { get; set; } = "2.2.0";
    public int SoftTimeoutMinutes { get; set; } = 8;
    public int HardTimeoutMinutes { get; set; } = 25;
    public bool Verbose { get; set; }
}
