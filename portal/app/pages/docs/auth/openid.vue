<template>
  <div>
    <h2 class="mb-4 text-2xl font-semibold text-slate-900 dark:text-white">OpenID Connect (OneLogin m.fl.)</h2>
    <p class="mb-6 text-slate-600 dark:text-slate-400">
      Konfigurera OpenID Connect för autentisering via CloudPortal. Denna guide visar hur du konfigurerar OneLogin, men samma process fungerar för andra OIDC-kompatibla identity providers.
    </p>
    
    <div class="space-y-6">
      <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-800/50">
        <h3 class="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Snabbguide</h3>
        <ol class="space-y-3 text-slate-600 dark:text-slate-400">
          <li class="flex gap-3">
            <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">1</span>
            <span>Skapa en ny OIDC-app i din IdP (t.ex. OneLogin) och välj Web-klient.</span>
          </li>
          <li class="flex gap-3">
            <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">2</span>
            <span>Ange din organisations Redirect URL i IdP:n. Du hittar denna URL i CloudPortal under Auth-inställningar.</span>
          </li>
          <li class="flex gap-3">
            <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">3</span>
            <span>Kopiera Issuer/Discovery URL, Client ID och Client Secret från IdP:n.</span>
          </li>
          <li class="flex gap-3">
            <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">4</span>
            <span>Fyll i dessa värden i CloudPortal under Auth-inställningar för din organisation.</span>
          </li>
          <li class="flex gap-3">
            <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">5</span>
            <span>Testa inloggningen innan du aktiverar "Kräv SSO" i portalen.</span>
          </li>
        </ol>
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-800/50">
        <h3 class="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Detaljerad guide: OneLogin</h3>
        
        <div class="space-y-6">
          <div>
            <h4 class="mb-3 text-base font-semibold text-slate-900 dark:text-white">1. Skapa en applikation i OneLogin</h4>
            <ol class="ml-4 list-decimal space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>Logga in på din OneLogin admin portal.</li>
              <li>Gå till <strong>Applications</strong> → <strong>Applications</strong> och välj <strong>Add App</strong>.</li>
              <li>Sök efter "OIDC" och välj <strong>OpenId Connect (OIDC)</strong> av OneLogin, Inc.</li>
              <li>I <strong>Display Name</strong>, ange ett namn för din applikation. Välj <strong>Save</strong>.</li>
              <li>Gå till <strong>Configuration</strong>. I fältet <strong>Redirect URI</strong>, ange din organisations callback-URL från CloudPortal. Denna URL visas i Auth-inställningarna i CloudPortal.</li>
              <li>Välj <strong>Save</strong>.</li>
              <li>Gå till <strong>Access</strong> och välj de <strong>Roles</strong> som kan komma åt denna applikation. Välj <strong>Save</strong>.</li>
              <li>Gå till <strong>SSO</strong> och välj <strong>Show client secret</strong>.</li>
              <li>Kopiera <strong>Client ID</strong> och <strong>Client Secret</strong>. Du behöver dessa värden i steg 2.</li>
            </ol>
          </div>

          <div>
            <h4 class="mb-3 text-base font-semibold text-slate-900 dark:text-white">2. Konfigurera OneLogin i CloudPortal</h4>
            <ol class="ml-4 list-decimal space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>Gå till Auth-inställningar i CloudPortal för din organisation.</li>
              <li>Välj <strong>OpenID Connect</strong> som Identity Provider.</li>
              <li>Fyll i följande information:
                <ul class="ml-6 mt-2 list-disc space-y-1">
                  <li><strong>Issuer (Discovery URL)</strong>: Din OneLogin-domän, t.ex. <code>https://&lt;din-domän&gt;.onelogin.com</code></li>
                  <li><strong>Client ID</strong>: Det Client ID du kopierade från OneLogin</li>
                  <li><strong>Client Secret</strong>: Det Client Secret du kopierade från OneLogin</li>
                  <li><strong>Redirect URL</strong>: Denna fylls i automatiskt med din organisations callback-URL</li>
                </ul>
              </li>
              <li>Välj <strong>Spara ändringar</strong>.</li>
            </ol>
          </div>

          <div class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/5">
            <p class="text-sm text-amber-800 dark:text-amber-200">
              <strong>Tips:</strong> Testa inloggningen genom att logga ut och försöka logga in igen med din OneLogin-konto innan du aktiverar "Kräv SSO". Detta säkerställer att konfigurationen fungerar korrekt.
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
