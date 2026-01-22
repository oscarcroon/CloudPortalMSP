<template>
  <div>
    <div v-if="route.path === '/docs/auth'">
      <h2 class="mb-4 text-2xl font-semibold text-slate-900 dark:text-white">Auth &amp; SSO</h2>
      <p class="mb-6 text-slate-600 dark:text-slate-400">
        Konfigurera Single Sign-On (SSO) för din organisation med olika Identity Providers.
      </p>
      <div class="space-y-6">
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-6 dark:border-white/10 dark:bg-slate-800/50">
          <h3 class="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Översikt</h3>
          <p class="mb-4 text-slate-600 dark:text-slate-400">
            CloudPortal stödjer flera Identity Providers (IdP) för autentisering. Välj den provider som passar din organisation och följ guiden för att konfigurera SSO.
          </p>
          <p class="text-slate-600 dark:text-slate-400">
            Efter att du har konfigurerat IdP:n och fyllt i uppgifterna i CloudPortal kan du aktivera "Kräv SSO" för att tvinga alla användare att logga in via den valda IdP:n.
          </p>
        </div>
        <div class="grid gap-4 md:grid-cols-3">
          <NuxtLink
            to="/docs/auth/openid"
            class="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-brand hover:shadow-lg dark:border-white/10 dark:bg-slate-800/50 dark:hover:border-brand"
          >
            <h3 class="mb-2 text-base font-semibold text-slate-900 dark:text-white">OpenID Connect</h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">
              För OneLogin och andra OIDC-kompatibla providers.
            </p>
          </NuxtLink>
          <NuxtLink
            to="/docs/auth/entra"
            class="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-brand hover:shadow-lg dark:border-white/10 dark:bg-slate-800/50 dark:hover:border-brand"
          >
            <h3 class="mb-2 text-base font-semibold text-slate-900 dark:text-white">Microsoft Entra ID</h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">
              För Azure AD / Microsoft Entra ID.
            </p>
          </NuxtLink>
          <NuxtLink
            to="/docs/auth/saml"
            class="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-brand hover:shadow-lg dark:border-white/10 dark:bg-slate-800/50 dark:hover:border-brand"
          >
            <h3 class="mb-2 text-base font-semibold text-slate-900 dark:text-white">SAML 2.0</h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">
              För Azure AD, Okta och andra SAML-providers.
            </p>
          </NuxtLink>
        </div>
      </div>
    </div>
    <NuxtPage v-else />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const route = useRoute()
</script>

