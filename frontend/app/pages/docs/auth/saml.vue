<template>
  <div>
    <h2 class="mb-4 text-2xl font-semibold text-slate-900 dark:text-white">SAML 2.0 (Azure AD, Okta m.fl.)</h2>
    <p class="mb-6 text-slate-600 dark:text-slate-400">
      Konfigurera SAML 2.0 för autentisering via CloudPortal. Denna guide fungerar för Azure AD, Okta och andra SAML-kompatibla identity providers.
    </p>
    
    <div class="space-y-6">
      <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-800/50">
        <h3 class="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Snabbguide</h3>
        <ol class="space-y-3 text-slate-600 dark:text-slate-400">
          <li class="flex gap-3">
            <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">1</span>
            <span>Skapa en ny SAML-app i din IdP och ange ACS/Callback URL till din organisations redirect-URL.</span>
          </li>
          <li class="flex gap-3">
            <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">2</span>
            <span>Kopiera Issuer/Entity ID, Entry Point (SSO URL) och publik X.509-certifikat från IdP:n.</span>
          </li>
          <li class="flex gap-3">
            <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">3</span>
            <span>Fyll i Entry Point, Issuer och Certificate i CloudPortal under Auth-inställningar.</span>
          </li>
          <li class="flex gap-3">
            <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">4</span>
            <span>Ange eventuella Audience/Entity ID som förväntas av IdP:n och välj om AuthnRequests ska signeras.</span>
          </li>
          <li class="flex gap-3">
            <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">5</span>
            <span>Testa inloggningen innan du aktiverar "Kräv SSO" i CloudPortal.</span>
          </li>
        </ol>
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-800/50">
        <h3 class="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Detaljerad guide</h3>
        
        <div class="space-y-6">
          <div>
            <h4 class="mb-3 text-base font-semibold text-slate-900 dark:text-white">1. Skapa en SAML-applikation i din IdP</h4>
            <p class="mb-3 text-sm text-slate-600 dark:text-slate-400">
              Processen varierar beroende på vilken IdP du använder, men generella steg inkluderar:
            </p>
            <ol class="ml-4 list-decimal space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>Logga in på din IdP:s admin-portal.</li>
              <li>Skapa en ny SAML-applikation eller enterprise-applikation.</li>
              <li>Ange <strong>ACS/Callback URL</strong> till din organisations callback-URL från CloudPortal. Denna URL visas i Auth-inställningarna i CloudPortal.</li>
              <li>Konfigurera eventuella ytterligare inställningar som krävs av din IdP.</li>
            </ol>
          </div>

          <div>
            <h4 class="mb-3 text-base font-semibold text-slate-900 dark:text-white">2. Kopiera SAML-konfiguration från din IdP</h4>
            <p class="mb-3 text-sm text-slate-600 dark:text-slate-400">
              Du behöver följande värden från din IdP:
            </p>
            <ul class="ml-4 mb-4 list-disc space-y-1 text-sm text-slate-600 dark:text-slate-400">
              <li><strong>Entry Point (SSO URL)</strong>: URL:en där användare skickas för autentisering</li>
              <li><strong>Issuer (Entity ID)</strong>: Unik identifierare för din IdP</li>
              <li><strong>Publikt X.509-certifikat</strong>: Certifikatet som används för att verifiera signerade assertioner</li>
              <li><strong>Audience (valfritt)</strong>: Entity ID som IdP:n förväntar sig i SAML-requests</li>
            </ul>
            <p class="text-sm text-slate-600 dark:text-slate-400">
              Dessa värden hittar du vanligtvis i din IdP:s SAML-konfiguration eller metadata.
            </p>
          </div>

          <div>
            <h4 class="mb-3 text-base font-semibold text-slate-900 dark:text-white">3. Konfigurera SAML i CloudPortal</h4>
            <ol class="ml-4 list-decimal space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>Gå till Auth-inställningar i CloudPortal för din organisation.</li>
              <li>Välj <strong>SAML 2.0</strong> som Identity Provider.</li>
              <li>Fyll i följande information:
                <ul class="ml-6 mt-2 list-disc space-y-1">
                  <li><strong>Entry Point (SSO URL)</strong>: SSO-URL:en från din IdP</li>
                  <li><strong>Issuer (Entity ID)</strong>: Entity ID från din IdP</li>
                  <li><strong>Publikt certifikat</strong>: X.509-certifikatet från din IdP (inkludera BEGIN och END-raderna)</li>
                  <li><strong>Audience (valfritt)</strong>: Om din IdP kräver en specifik audience</li>
                </ul>
              </li>
              <li>Konfigurera signeringsalternativ:
                <ul class="ml-6 mt-2 list-disc space-y-1">
                  <li><strong>Signera AuthnRequest</strong>: Aktivera om din IdP förväntar sig signerade requests (rekommenderas)</li>
                  <li><strong>Kräv signerade assertioner</strong>: Aktivera för att säkerställa att IdP signerar svaren</li>
                </ul>
              </li>
              <li>Välj <strong>Spara ändringar</strong>.</li>
            </ol>
          </div>

          <div class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/5">
            <p class="text-sm text-amber-800 dark:text-amber-200">
              <strong>Tips:</strong> Testa inloggningen genom att logga ut och försöka logga in igen med ditt IdP-konto innan du aktiverar "Kräv SSO". Detta säkerställer att konfigurationen fungerar korrekt.
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

