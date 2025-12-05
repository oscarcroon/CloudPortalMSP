<template>
  <div>
    <h2 class="mb-4 text-2xl font-semibold text-slate-900 dark:text-white">Microsoft Entra ID (Azure AD)</h2>
    <p class="mb-6 text-slate-600 dark:text-slate-400">
      Konfigurera Microsoft Entra ID (tidigare Azure Active Directory) för autentisering via CloudPortal. Du kan bygga policies baserat på användaridentitet och gruppmedlemskap.
    </p>
    
    <div class="space-y-6">
      <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-800/50">
        <h3 class="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Snabbguide</h3>
        <ol class="space-y-3 text-slate-600 dark:text-slate-400">
          <li class="flex gap-3">
            <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">1</span>
            <span>Registrera en ny Entra-app (App registration) och välj Web som plattform.</span>
          </li>
          <li class="flex gap-3">
            <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">2</span>
            <span>Sätt Redirect URI till din organisations callback-URL från CloudPortal.</span>
          </li>
          <li class="flex gap-3">
            <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">3</span>
            <span>Anteckna Application (client) ID, Directory (tenant) ID och skapa ett Client secret.</span>
          </li>
          <li class="flex gap-3">
            <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">4</span>
            <span>Konfigurera API-behörigheter i Entra ID.</span>
          </li>
          <li class="flex gap-3">
            <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">5</span>
            <span>Fyll i Tenant ID, Client ID och Client Secret i CloudPortal innan du kräver SSO.</span>
          </li>
        </ol>
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-800/50">
        <h3 class="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Detaljerad guide</h3>
        
        <div class="space-y-6">
          <div>
            <h4 class="mb-3 text-base font-semibold text-slate-900 dark:text-white">1. Hämta Entra ID-inställningar</h4>
            <p class="mb-3 text-sm text-slate-600 dark:text-slate-400">
              Följande Entra ID-värden krävs för att konfigurera integrationen:
            </p>
            <ul class="ml-4 mb-4 list-disc space-y-1 text-sm text-slate-600 dark:text-slate-400">
              <li>Application (client) ID</li>
              <li>Directory (tenant) ID</li>
              <li>Client secret</li>
            </ul>
            <ol class="ml-4 list-decimal space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>Logga in på <a href="https://entra.microsoft.com" target="_blank" rel="noopener" class="text-brand hover:underline">Microsoft Entra admin center</a>.</li>
              <li>Gå till <strong>Applications</strong> → <strong>Enterprise applications</strong>.</li>
              <li>Välj <strong>New application</strong>, sedan <strong>Create your own application</strong>.</li>
              <li>Namnge din applikation.</li>
              <li>Välj <strong>Register an application to integrate with Microsoft Entra ID (App you're developing)</strong>. Välj inte någon av galleriapplikationerna om det erbjuds. Välj <strong>Create</strong>.</li>
              <li>Under <strong>Redirect URI</strong>, välj Web-plattformen och ange din organisations callback-URL från CloudPortal. Denna URL visas i Auth-inställningarna i CloudPortal.</li>
              <li>Välj <strong>Register</strong>.</li>
              <li>Gå tillbaka till Microsoft Entra ID och gå till <strong>Applications</strong> → <strong>App registrations</strong>.</li>
              <li>Välj <strong>All applications</strong> och välj den app du just skapade. Kopiera <strong>Application (client) ID</strong> och <strong>Directory (tenant) ID</strong>. Du behöver dessa värden när du konfigurerar Entra ID i CloudPortal.</li>
              <li>På samma sida, under <strong>Client credentials</strong>, gå till <strong>Add a certificate or secret</strong>. Välj <strong>New client secret</strong>.</li>
              <li>Namnge client secret och välj en utgångsperiod.</li>
              <li>Efter att client secret har skapats, kopiera dess <strong>Value</strong>-fält. Spara client secret på en säker plats, eftersom det endast kan visas direkt efter skapandet. Du behöver detta värde när du konfigurerar Entra ID i CloudPortal.</li>
            </ol>
            <div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/5">
              <p class="text-xs text-amber-800 dark:text-amber-200">
                <strong>Viktigt:</strong> När client secret går ut kommer användare inte att kunna logga in via Access. Notera ditt utgångsdatum för att förhindra inloggningsfel och förnya ditt client secret när det behövs.
              </p>
            </div>
          </div>

          <div>
            <h4 class="mb-3 text-base font-semibold text-slate-900 dark:text-white">2. Konfigurera API-behörigheter i Entra ID</h4>
            <ol class="ml-4 list-decimal space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>Gå till <strong>App registrations</strong> → <strong>All applications</strong> → välj din applikation → <strong>API permissions</strong>.</li>
              <li>Välj <strong>Add a permission</strong>.</li>
              <li>Välj <strong>Microsoft Graph</strong>.</li>
              <li>Välj <strong>Delegated permissions</strong> och aktivera följande behörigheter:
                <ul class="ml-6 mt-2 list-disc space-y-1">
                  <li><code>email</code></li>
                  <li><code>offline_access</code></li>
                  <li><code>openid</code></li>
                  <li><code>profile</code></li>
                  <li><code>User.Read</code></li>
                  <li><code>Directory.Read.All</code></li>
                  <li><code>GroupMember.Read.All</code></li>
                </ul>
              </li>
              <li>När alla sju behörigheter är aktiverade, välj <strong>Add permissions</strong>.</li>
              <li>Välj <strong>Grant admin consent</strong>.</li>
            </ol>
          </div>

          <div>
            <h4 class="mb-3 text-base font-semibold text-slate-900 dark:text-white">3. Konfigurera Entra ID i CloudPortal</h4>
            <ol class="ml-4 list-decimal space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>Gå till Auth-inställningar i CloudPortal för din organisation.</li>
              <li>Välj <strong>Microsoft Entra ID</strong> som Identity Provider.</li>
              <li>Fyll i följande information:
                <ul class="ml-6 mt-2 list-disc space-y-1">
                  <li><strong>Tenant ID</strong>: Directory (tenant) ID från Microsoft Entra ID</li>
                  <li><strong>Client ID</strong>: Application (client) ID från Microsoft Entra ID</li>
                  <li><strong>Client Secret</strong>: Client secret-värdet du kopierade</li>
                  <li><strong>Redirect URL</strong>: Denna fylls i automatiskt med din organisations callback-URL</li>
                </ul>
              </li>
              <li>Välj <strong>Spara ändringar</strong>.</li>
            </ol>
          </div>

          <div>
            <h4 class="mb-3 text-base font-semibold text-slate-900 dark:text-white">UPN och e-post</h4>
            <p class="mb-3 text-sm text-slate-600 dark:text-slate-400">
              Om din organisations UPN:er inte matchar användarnas e-postadresser måste du lägga till en anpassad claim för e-post. Till exempel, om din organisations e-postformat är <code>user@domain.com</code> men UPN är <code>u908080@domain.com</code>, måste du skapa en e-postclaim om du konfigurerar e-postbaserade policies.
            </p>
            <p class="mb-3 text-sm text-slate-600 dark:text-slate-400">
              För att ta emot en e-postclaim i id_token från Microsoft Entra måste du:
            </p>
            <ol class="ml-4 list-decimal space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>I Microsoft Entra admin center, gå till <strong>Application</strong> → <strong>App registration</strong> → <strong>All applications</strong> och välj den relevanta applikationen.</li>
              <li>Under <strong>Manage</strong>, välj <strong>Token configuration</strong>.</li>
              <li>Lägg till en claim för e-post.</li>
            </ol>
          </div>

          <div class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/5">
            <p class="text-sm text-amber-800 dark:text-amber-200">
              <strong>Tips:</strong> Testa inloggningen genom att logga ut och försöka logga in igen med ditt Entra ID-konto innan du aktiverar "Kräv SSO". Detta säkerställer att konfigurationen fungerar korrekt.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
})
</script>
