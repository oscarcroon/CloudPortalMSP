using CertAgent.Worker.Configuration;
using CertAgent.Worker.Services;
using CertAgent.Worker.Workers;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    Log.Information("CertAgent.Worker starting");

    var builder = Host.CreateApplicationBuilder(args);

    // Serilog
    builder.Services.AddSerilog(config => config
        .ReadFrom.Configuration(builder.Configuration));

    // Configuration binding
    builder.Services.Configure<PortalApiOptions>(
        builder.Configuration.GetSection(PortalApiOptions.SectionName));
    builder.Services.Configure<SimpleAcmeOptions>(
        builder.Configuration.GetSection(SimpleAcmeOptions.SectionName));
    builder.Services.Configure<AgentBehaviorOptions>(
        builder.Configuration.GetSection(AgentBehaviorOptions.SectionName));

    // HTTP client for portal API
    var portalOptions = builder.Configuration
        .GetSection(PortalApiOptions.SectionName)
        .Get<PortalApiOptions>() ?? new PortalApiOptions();

    builder.Services.AddHttpClient(PortalApiClient.HttpClientName, client =>
    {
        PortalApiClient.ConfigureHttpClient(client, portalOptions);
    });

    // Services
    builder.Services.AddSingleton<PortalApiClient>();
    builder.Services.AddSingleton<SimpleAcmeExecutor>();
    builder.Services.AddSingleton<CertificateMetadataReader>();
    builder.Services.AddSingleton<ScheduledTaskManager>();
    builder.Services.AddTransient<LogStreamingService>();

    // Workers
    builder.Services.AddHostedService<HeartbeatWorker>();
    builder.Services.AddHostedService<WorkPollingWorker>();

    // Windows Service support
    builder.Services.AddWindowsService(options =>
    {
        options.ServiceName = "CertAgent";
    });

    var host = builder.Build();

    // Validate critical configuration
    if (string.IsNullOrEmpty(portalOptions.AgentToken))
    {
        Log.Warning("PortalApi:AgentToken is not configured — agent will fail to authenticate. " +
                     "Set via appsettings.json or PortalApi__AgentToken environment variable.");
    }

    await host.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "CertAgent.Worker terminated unexpectedly");
    return 1;
}
finally
{
    await Log.CloseAndFlushAsync();
}

return 0;
