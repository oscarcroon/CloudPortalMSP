using System.Security.AccessControl;
using System.Security.Principal;

namespace CertAgent.Worker.Helpers;

/// <summary>
/// Creates temp files for secrets (EAB HMAC) with restrictive ACLs.
/// Ensures secrets never appear in command line args or process lists.
/// </summary>
public static class SecretFileHelper
{
    /// <summary>
    /// Write a secret to a temp file with restrictive ACL (current user only).
    /// Returns the temp file path. Caller must delete in finally block.
    /// </summary>
    public static string WriteSecretToTempFile(string secret)
    {
        var tempPath = Path.Combine(Path.GetTempPath(), $"certagent-{Guid.NewGuid():N}.tmp");
        File.WriteAllText(tempPath, secret);

        try
        {
            var fileInfo = new FileInfo(tempPath);
            var security = fileInfo.GetAccessControl();

            // Remove inherited rules
            security.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);

            var currentUser = WindowsIdentity.GetCurrent().User;
            if (currentUser != null)
            {
                // Remove all existing rules
                var rules = security.GetAccessRules(true, true, typeof(SecurityIdentifier));
                foreach (FileSystemAccessRule rule in rules)
                {
                    security.RemoveAccessRule(rule);
                }

                // Grant only current user full control
                security.AddAccessRule(new FileSystemAccessRule(
                    currentUser,
                    FileSystemRights.FullControl,
                    AccessControlType.Allow));

                fileInfo.SetAccessControl(security);
            }
        }
        catch
        {
            // ACL restriction is defense-in-depth; don't fail the whole operation
        }

        // Register the path for log redaction
        LogRedactor.AddDynamicPattern(tempPath, "[SECRET_FILE]");

        return tempPath;
    }

    /// <summary>
    /// Safely delete a secret temp file.
    /// </summary>
    public static void DeleteSecretFile(string? path)
    {
        if (string.IsNullOrEmpty(path)) return;
        try
        {
            if (File.Exists(path))
                File.Delete(path);
        }
        catch
        {
            // Best effort
        }
    }
}
