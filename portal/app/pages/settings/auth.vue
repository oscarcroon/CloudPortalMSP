<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <NuxtLink
        to="/settings"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        {{ t('settings.auth.backToSettings') }}
      </NuxtLink>
      <div>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">{{ t('settings.auth.title') }}</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          {{ t('settings.auth.pageDescription') }}
        </p>
      </div>
    </header>

    <div v-if="!currentOrgId" class="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-300">
      {{ t('settings.auth.noActiveOrg') }}
    </div>

    <div
      v-else-if="pending"
      class="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-[#0c1524] dark:text-slate-300"
    >
      {{ t('settings.auth.loading') }}
    </div>

    <div
      v-else-if="errorMessage && !organization"
      class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/5 dark:text-red-200"
    >
      {{ errorMessage }}
    </div>

    <form
      v-else-if="organization"
      class="space-y-6"
      @submit.prevent="handleSave"
    >
      <div v-if="successMessage" class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/5 dark:text-emerald-200">
        {{ successMessage }}
      </div>
      <div v-if="errorMessage" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/5 dark:text-red-200">
        {{ errorMessage }}
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-[#101932]">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.auth.organization') }}</p>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ organization.name }}</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">{{ t('settings.auth.slug') }}: {{ organization.slug }}</p>
          </div>
          <button
            type="submit"
            class="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand/85 disabled:opacity-50"
            :disabled="saving"
          >
            {{ saving ? t('settings.auth.saving') : t('settings.auth.save') }}
          </button>
        </div>

        <div class="mt-6 grid gap-4 md:grid-cols-2">
          <label class="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 dark:border-white/10">
            <input
              id="settings-auth-require-sso"
              v-model="form.requireSso"
              type="checkbox"
              class="rounded border-slate-300 dark:border-white/20"
              :disabled="requireSsoDisabled"
            />
            <div>
              <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ t('settings.auth.requireSso.title') }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ t('settings.auth.requireSso.description') }}
              </p>
              <p v-if="requireSsoDisabled" class="text-xs text-amber-600 dark:text-amber-300">
                {{ requireSsoDisabledMessage }}
              </p>
            </div>
          </label>

          <label class="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 dark:border-white/10">
            <input
              id="settings-auth-owner-local"
              v-model="form.allowLocalLoginForOwners"
              type="checkbox"
              class="rounded border-slate-300 dark:border-white/20"
            />
            <div>
              <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ t('settings.auth.allowLocalLogin.title') }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('settings.auth.allowLocalLogin.description') }}</p>
            </div>
          </label>

          <label class="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 dark:border-white/10">
            <input
              id="settings-auth-require-mfa"
              v-model="form.requireMfa"
              type="checkbox"
              class="rounded border-slate-300 dark:border-white/20"
            />
            <div>
              <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ t('settings.auth.requireMfa.title') }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('settings.auth.requireMfa.description') }}</p>
            </div>
          </label>
        </div>
      </div>

      <!-- SSO Domains section — FIRST step in the flow -->
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-[#101932]">
        <div class="flex flex-col gap-2">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ t('settings.auth.ssoDomains.title') }}</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            {{ t('settings.auth.ssoDomains.description') }}
          </p>
        </div>

        <div
          v-if="ssoDomainMessage"
          class="mt-4 rounded-lg border px-4 py-3 text-sm"
          :class="ssoDomainMessageType === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/5 dark:text-emerald-200'
            : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/5 dark:text-red-200'"
        >
          {{ ssoDomainMessage }}
        </div>

        <!-- Add domain form -->
        <div class="mt-4 flex gap-2">
          <input
            v-model="newDomain"
            type="text"
            :placeholder="t('settings.auth.ssoDomains.domainPlaceholder')"
            class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
            :disabled="addingDomain"
            @keydown.enter.prevent="handleAddDomain"
          />
          <button
            type="button"
            class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/85 disabled:opacity-50"
            :disabled="!newDomain.trim() || addingDomain"
            @click="handleAddDomain"
          >
            {{ t('settings.auth.ssoDomains.add') }}
          </button>
        </div>

        <!-- Domain list -->
        <div v-if="ssoDomains.length" class="mt-4 space-y-3">
          <div
            v-for="domain in ssoDomains"
            :key="domain.id"
            class="rounded-lg border border-slate-200 px-4 py-3 dark:border-white/10"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ domain.domain }}</span>
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="domain.verificationStatus === 'verified'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'"
                >
                  {{ domain.verificationStatus === 'verified' ? t('settings.auth.ssoDomains.verified') : t('settings.auth.ssoDomains.pending') }}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <button
                  v-if="domain.verificationStatus !== 'verified'"
                  type="button"
                  class="rounded px-3 py-1 text-xs font-semibold text-brand transition hover:bg-brand/10"
                  :disabled="verifyingDomain === domain.domain"
                  @click="handleVerifyDomain(domain.domain)"
                >
                  {{ t('settings.auth.ssoDomains.verify') }}
                </button>
                <button
                  type="button"
                  class="rounded px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                  :disabled="removingDomain === domain.domain"
                  @click="handleRemoveDomain(domain.domain)"
                >
                  {{ t('settings.auth.ssoDomains.remove') }}
                </button>
              </div>
            </div>

            <!-- Verification instructions for pending domains -->
            <div v-if="domain.verificationStatus !== 'verified' && domain.verificationInstructions" class="mt-3 rounded-lg bg-slate-50 p-3 text-xs dark:bg-white/5">
              <p class="mb-2 text-slate-500 dark:text-slate-400">{{ t('settings.auth.ssoDomains.verifyInstructions') }}</p>
              <div class="space-y-1 font-mono text-slate-700 dark:text-slate-300">
                <p><span class="text-slate-500 dark:text-slate-400">{{ t('settings.auth.ssoDomains.recordType') }}:</span> TXT</p>
                <p><span class="text-slate-500 dark:text-slate-400">{{ t('settings.auth.ssoDomains.recordName') }}:</span> {{ domain.verificationInstructions.recordName }}</p>
                <p><span class="text-slate-500 dark:text-slate-400">{{ t('settings.auth.ssoDomains.recordValue') }}:</span> {{ domain.verificationInstructions.recordValue }}</p>
              </div>
            </div>
          </div>
        </div>

        <p v-else class="mt-4 text-sm text-slate-500 dark:text-slate-400">
          {{ t('settings.auth.ssoDomains.noDomains') }}
        </p>
      </div>

      <!-- Identity Provider section — disabled until a domain is verified -->
      <div
        class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-[#101932]"
        :class="{ 'opacity-50 pointer-events-none': !hasVerifiedSsoDomain }"
      >
        <div class="flex flex-col gap-2">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ t('settings.auth.idp.title') }}</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            {{ t('settings.auth.idp.description') }}
          </p>
          <p v-if="!hasVerifiedSsoDomain" class="text-xs text-amber-600 dark:text-amber-300">
            {{ t('settings.auth.idp.idpDisabled') }}
          </p>
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-3">
          <label
            v-for="option in providerOptions"
            :key="option.value"
            class="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition cursor-pointer"
            :class="
              form.idpProvider === option.value
                ? 'border-brand bg-brand/5 text-brand dark:border-brand/80 dark:text-brand-light'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800/50'
            "
          >
            <input
              type="radio"
              name="idpProvider"
              :value="option.value"
              v-model="form.idpProvider"
              class="text-brand focus:ring-brand"
              :disabled="!hasVerifiedSsoDomain"
            />
            <IconifyIcon
              :icon="option.icon"
              class="h-5 w-5 flex-shrink-0"
            />
            <span class="font-semibold">{{ option.label }}</span>
          </label>
        </div>

        <div v-if="form.idpProvider !== 'none'" class="mt-6 space-y-4">
          <p class="text-sm text-slate-500 dark:text-slate-400">
            {{ t('settings.auth.idp.redirectUriHint') }}
            <code class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-800 dark:bg-white/10 dark:text-slate-200">{{ redirectUriHint }}</code>
          </p>

          <div v-if="form.idpProvider === 'openid'" class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.auth.idp.openid.issuer') }}</label>
              <input
                v-model="form.openid.issuer"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                placeholder="https://idp.example.com"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.auth.idp.openid.metadataUrl') }}</label>
              <input
                v-model="form.openid.metadataUrl"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                placeholder="https://idp.example.com/.well-known/openid-configuration"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.auth.idp.openid.clientId') }}</label>
              <input
                v-model="form.openid.clientId"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.auth.idp.openid.clientSecret') }}</label>
              <input
                v-model="form.openid.clientSecret"
                type="password"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.auth.idp.openid.redirectUri') }}</label>
              <input
                v-model="form.openid.redirectUri"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                :placeholder="redirectUriHint"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.auth.idp.openid.scopes') }}</label>
              <input
                v-model="form.openid.scopes"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                placeholder="openid email profile"
              />
            </div>
          </div>

          <div v-else-if="form.idpProvider === 'entra'" class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.auth.idp.entra.tenantId') }}</label>
              <input
                v-model="form.entra.tenantId"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.auth.idp.entra.clientId') }}</label>
              <input
                v-model="form.entra.clientId"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.auth.idp.entra.clientSecret') }}</label>
              <input
                v-model="form.entra.clientSecret"
                type="password"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.auth.idp.entra.redirectUri') }}</label>
              <input
                v-model="form.entra.redirectUri"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                :placeholder="redirectUriHint"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.auth.idp.entra.scopes') }}</label>
              <input
                v-model="form.entra.scopes"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                placeholder="openid email profile offline_access"
              />
            </div>
          </div>
          <div v-else-if="form.idpProvider === 'saml'" class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.auth.idp.saml.entryPoint') }}</label>
              <input
                v-model="form.saml.entryPoint"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                placeholder="https://idp.example.com/saml/login"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.auth.idp.saml.issuer') }}</label>
              <input
                v-model="form.saml.issuer"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                placeholder="https://idp.example.com/metadata"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.auth.idp.saml.audience') }}</label>
              <input
                v-model="form.saml.audience"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                placeholder="https://customer-portal.example.com"
              />
            </div>
            <div class="md:col-span-2">
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.auth.idp.saml.certificate') }}</label>
              <textarea
                v-model="form.saml.certificate"
                rows="5"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                placeholder="-----BEGIN CERTIFICATE-----"
              />
            </div>
            <label class="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 dark:border-white/10">
              <input
                v-model="form.saml.signRequest"
                type="checkbox"
                class="rounded border-slate-300 dark:border-white/20"
              />
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ t('settings.auth.idp.saml.signRequest.title') }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('settings.auth.idp.saml.signRequest.description') }}</p>
              </div>
            </label>
            <label class="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 dark:border-white/10">
              <input
                v-model="form.saml.wantAssertionsSigned"
                type="checkbox"
                class="rounded border-slate-300 dark:border-white/20"
              />
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ t('settings.auth.idp.saml.wantAssertionsSigned.title') }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('settings.auth.idp.saml.wantAssertionsSigned.description') }}</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div v-if="form.idpProvider !== 'none'" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-[#101932]">
        <div class="flex flex-col gap-2">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ t('settings.auth.configGuide.title') }}</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            {{ t('settings.auth.configGuide.description', { idp: selectedGuide?.title || t('settings.auth.idp.title') }) }}
          </p>
        </div>

        <div v-if="selectedGuide" class="mt-4">
          <article class="rounded-xl border border-brand bg-brand/5 p-4 dark:border-brand/60">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-base font-semibold text-slate-900 dark:text-white">{{ selectedGuide.title }}</h3>
              <NuxtLink
                :to="selectedGuide.localDocUrl"
                class="text-xs font-semibold text-brand hover:underline"
              >
                {{ t('settings.auth.configGuide.readMore') }}
              </NuxtLink>
            </div>
            <ol class="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
              <li v-for="step in selectedGuide.steps" :key="step">
                {{ step }}
              </li>
            </ol>
          </article>
        </div>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from '#imports'

const { t } = useI18n()
import { computed, reactive, ref, useFetch, useRuntimeConfig, watch } from '#imports'
import { Icon as IconifyIcon } from '@iconify/vue'
import type { AdminOrganizationDetail, OrganizationAuthUpdatePayload } from '~/types/admin'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'default'
})

const auth = useAuth()
const errorMessage = ref('')
const successMessage = ref('')
const saving = ref(false)

// SSO Domains state
interface SsoDomainEntry {
  id: string
  domain: string
  verificationStatus: string
  verifiedAt: string | null
  createdAt: string
  verificationInstructions?: {
    recordName: string
    recordValue: string
  } | null
}
const ssoDomains = ref<SsoDomainEntry[]>([])
const newDomain = ref('')
const addingDomain = ref(false)
const verifyingDomain = ref<string | null>(null)
const removingDomain = ref<string | null>(null)
const ssoDomainMessage = ref('')
const ssoDomainMessageType = ref<'success' | 'error'>('success')

const providerOptions = computed(() => [
  { value: 'none', label: t('settings.auth.idp.providers.none'), icon: 'mdi:cancel' },
  { value: 'openid', label: t('settings.auth.idp.providers.openid'), icon: 'simple-icons:openid' },
  { value: 'entra', label: t('settings.auth.idp.providers.entra'), icon: 'simple-icons:microsoftazure' },
  { value: 'saml', label: t('settings.auth.idp.providers.saml'), icon: 'mdi:shield-lock' }
] as const)

const form = reactive({
  requireSso: false,
  allowLocalLoginForOwners: true,
  requireMfa: false,
  idpProvider: 'none' as 'none' | 'openid' | 'entra' | 'saml',
  openid: {
    issuer: '',
    metadataUrl: '',
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    scopes: ''
  },
  entra: {
    tenantId: '',
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    scopes: ''
  },
  saml: {
    entryPoint: '',
    issuer: '',
    certificate: '',
    audience: '',
    signRequest: true,
    wantAssertionsSigned: true
  }
})

const { data, pending, refresh, error } = await (useFetch as any)('/api/organizations/auth', {
  server: true
})

watch(
  error,
  (value) => {
    if (!value) return
    errorMessage.value = value.message ?? t('settings.auth.idp.messages.loadError')
  },
  { immediate: true }
)

const organization = computed(() => data.value?.organization ?? null)
const currentOrgId = computed(() => auth.state.value.data?.currentOrgId ?? null)
const runtimeConfig = useRuntimeConfig()

const normalizeRedirectBase = () => {
  if (process.client && typeof window !== 'undefined') {
    return window.location.origin
  }
  const publicUrl = runtimeConfig.public?.appBase ?? runtimeConfig.public?.siteUrl
  return typeof publicUrl === 'string' && publicUrl.length > 0 ? publicUrl : ''
}

const redirectUriHint = computed(() => {
  const slug = organization.value?.slug ?? ':slug'
  const base = normalizeRedirectBase()
  if (!base) {
    return `/api/auth/sso/${slug}/callback`
  }
  return `${base.replace(/\/$/, '')}/api/auth/sso/${slug}/callback`
})

const providerGuides = computed(() => {
  const redirect = redirectUriHint.value
  const openidSteps = [
    t('settings.auth.configGuide.openid.steps.0'),
    t('settings.auth.configGuide.openid.steps.1', { redirect }),
    t('settings.auth.configGuide.openid.steps.2'),
    t('settings.auth.configGuide.openid.steps.3'),
    t('settings.auth.configGuide.openid.steps.4')
  ]
  const entraSteps = [
    t('settings.auth.configGuide.entra.steps.0'),
    t('settings.auth.configGuide.entra.steps.1', { redirect }),
    t('settings.auth.configGuide.entra.steps.2'),
    t('settings.auth.configGuide.entra.steps.3'),
    t('settings.auth.configGuide.entra.steps.4')
  ]
  const samlSteps = [
    t('settings.auth.configGuide.saml.steps.0'),
    t('settings.auth.configGuide.saml.steps.1'),
    t('settings.auth.configGuide.saml.steps.2'),
    t('settings.auth.configGuide.saml.steps.3'),
    t('settings.auth.configGuide.saml.steps.4')
  ]
  return [
    {
      provider: 'openid',
      title: t('settings.auth.configGuide.openid.title'),
      localDocUrl: '/docs/auth/openid',
      docUrl: 'https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/onelogin-oidc/',
      steps: openidSteps
    },
    {
      provider: 'entra',
      title: t('settings.auth.configGuide.entra.title'),
      localDocUrl: '/docs/auth/entra',
      docUrl: 'https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/entra-id/',
      steps: entraSteps
    },
    {
      provider: 'saml',
      title: t('settings.auth.configGuide.saml.title'),
      localDocUrl: '/docs/auth/saml',
      docUrl: 'https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/saml/',
      steps: samlSteps
    }
  ]
})

const selectedGuide = computed(() => {
  if (form.idpProvider === 'none') return null
  return providerGuides.value.find(guide => guide.provider === form.idpProvider) || null
})

const populateForm = () => {
  if (!data.value) return
  const { organization: org, authSettings } = data.value
  form.requireSso = org.requireSso
  form.allowLocalLoginForOwners = authSettings.allowLocalLoginForOwners
  form.requireMfa = authSettings.requireMfa ?? false

  if (authSettings.idpType === 'oidc' && authSettings.idpConfig) {
    const provider = (authSettings.idpConfig.provider as 'openid' | 'entra' | undefined) ?? 'openid'
    form.idpProvider = provider
    if (provider === 'openid') {
      form.openid.issuer = (authSettings.idpConfig.issuer as string) ?? ''
      form.openid.metadataUrl = (authSettings.idpConfig.metadataUrl as string) ?? ''
      form.openid.clientId = (authSettings.idpConfig.clientId as string) ?? ''
      form.openid.clientSecret = (authSettings.idpConfig.clientSecret as string) ?? ''
      form.openid.redirectUri =
        (authSettings.idpConfig.redirectUri as string) ?? redirectUriHint.value
      form.openid.scopes = (authSettings.idpConfig.scopes as string) ?? ''
    } else {
      form.entra.tenantId = (authSettings.idpConfig.tenantId as string) ?? ''
      form.entra.clientId = (authSettings.idpConfig.clientId as string) ?? ''
      form.entra.clientSecret = (authSettings.idpConfig.clientSecret as string) ?? ''
      form.entra.redirectUri =
        (authSettings.idpConfig.redirectUri as string) ?? redirectUriHint.value
      form.entra.scopes = (authSettings.idpConfig.scopes as string) ?? ''
    }
  } else if (authSettings.idpType === 'saml' && authSettings.idpConfig) {
    form.idpProvider = 'saml'
    form.saml.entryPoint = (authSettings.idpConfig.entryPoint as string) ?? ''
    form.saml.issuer = (authSettings.idpConfig.issuer as string) ?? ''
    form.saml.certificate = (authSettings.idpConfig.certificate as string) ?? ''
    form.saml.audience = (authSettings.idpConfig.audience as string) ?? ''
    form.saml.signRequest =
      (authSettings.idpConfig.signRequest as boolean | undefined) ?? true
    form.saml.wantAssertionsSigned =
      (authSettings.idpConfig.wantAssertionsSigned as boolean | undefined) ?? true
  } else {
    form.idpProvider = 'none'
  }

  if (!form.openid.redirectUri) {
    form.openid.redirectUri = redirectUriHint.value
  }
  if (!form.entra.redirectUri) {
    form.entra.redirectUri = redirectUriHint.value
  }
  if (!form.saml.entryPoint) {
    form.saml.entryPoint = ''
  }
}

watch(
  () => data.value,
  () => {
    populateForm()
  },
  { immediate: true }
)

watch(
  () => form.idpProvider,
  (provider) => {
    if (provider === 'none') {
      form.requireSso = false
    }
    errorMessage.value = ''
    successMessage.value = ''
  }
)

const hasVerifiedSsoDomain = computed(() =>
  ssoDomains.value.some((d) => d.verificationStatus === 'verified')
)

const providerConfigured = computed(() => {
  if (form.idpProvider === 'openid') {
    return Boolean(
      form.openid.issuer &&
        form.openid.clientId &&
        form.openid.clientSecret &&
        form.openid.redirectUri
    )
  }
  if (form.idpProvider === 'entra') {
    return Boolean(
      form.entra.tenantId &&
        form.entra.clientId &&
        form.entra.clientSecret &&
        form.entra.redirectUri
    )
  }
  if (form.idpProvider === 'saml') {
    return Boolean(form.saml.entryPoint && form.saml.issuer && form.saml.certificate)
  }
  return false
})

const requireSsoDisabled = computed(() =>
  form.idpProvider === 'none' || !providerConfigured.value || !hasVerifiedSsoDomain.value
)
const requireSsoDisabledMessage = computed(() => {
  if (!hasVerifiedSsoDomain.value) return t('settings.auth.idp.requireSsoDisabled.noDomain')
  if (form.idpProvider === 'none') return t('settings.auth.idp.requireSsoDisabled.noIdp')
  if (!providerConfigured.value) return t('settings.auth.idp.requireSsoDisabled.incomplete')
  return ''
})

const buildPayload = (): OrganizationAuthUpdatePayload => {
  const payload: OrganizationAuthUpdatePayload = {
    requireSso: form.requireSso,
    allowLocalLoginForOwners: form.allowLocalLoginForOwners,
    requireMfa: form.requireMfa
  }

  if (form.idpProvider === 'none') {
    payload.idpType = 'none'
    payload.idpConfig = null
    return payload
  }

  if (form.idpProvider === 'saml') {
    payload.idpType = 'saml'
    payload.idpConfig = {
      entryPoint: form.saml.entryPoint,
      issuer: form.saml.issuer,
      certificate: form.saml.certificate,
      audience: form.saml.audience || undefined,
      signRequest: form.saml.signRequest,
      wantAssertionsSigned: form.saml.wantAssertionsSigned
    }
    return payload
  }

  payload.idpType = 'oidc'

  if (form.idpProvider === 'openid') {
    payload.idpConfig = {
      provider: 'openid',
      issuer: form.openid.issuer,
      metadataUrl: form.openid.metadataUrl || undefined,
      clientId: form.openid.clientId,
      clientSecret: form.openid.clientSecret,
      redirectUri: form.openid.redirectUri,
      scopes: form.openid.scopes || undefined
    }
  } else {
    payload.idpConfig = {
      provider: 'entra',
      tenantId: form.entra.tenantId,
      clientId: form.entra.clientId,
      clientSecret: form.entra.clientSecret,
      redirectUri: form.entra.redirectUri,
      scopes: form.entra.scopes || undefined
    }
  }

  return payload
}

const validateProvider = (): string | null => {
  if (form.idpProvider === 'none') {
    return null
  }
  if (!providerConfigured.value) {
    return t('settings.auth.idp.validation.incomplete')
  }
  return null
}

const handleSave = async () => {
  if (!organization.value) {
    errorMessage.value = t('settings.auth.idp.validation.noOrg')
    return
  }

  const providerError = validateProvider()
  if (providerError) {
    errorMessage.value = providerError
    return
  }

  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await ($fetch as any)('/api/organizations/auth', {
      method: 'PATCH',
      body: buildPayload()
    })
    await refresh()
    successMessage.value = t('settings.auth.idp.messages.saved')
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : t('settings.auth.idp.messages.saveError')
  } finally {
    saving.value = false
  }
}

// ── SSO Domains ──────────────────────────────────────────────────────────

const fetchSsoDomains = async () => {
  if (!currentOrgId.value) return
  try {
    const response = await ($fetch as any)('/api/organizations/sso-domains')
    ssoDomains.value = (response.domains ?? []).map((d: any) => ({
      ...d,
      verificationInstructions: d.verificationInstructions ?? null
    }))
  } catch {
    // Silently fail — domains section is supplementary
  }
}

const handleAddDomain = async () => {
  if (!currentOrgId.value || !newDomain.value.trim()) return
  addingDomain.value = true
  ssoDomainMessage.value = ''
  try {
    const response = await ($fetch as any)('/api/organizations/sso-domains', {
      method: 'POST',
      body: { domain: newDomain.value.trim() }
    })
    ssoDomains.value.push({
      id: response.id,
      domain: response.domain,
      verificationStatus: response.verificationStatus,
      verifiedAt: null,
      createdAt: new Date().toISOString(),
      verificationInstructions: response.verificationInstructions
        ? { recordName: response.verificationInstructions.recordName, recordValue: response.verificationInstructions.recordValue }
        : null
    })
    newDomain.value = ''
    ssoDomainMessage.value = t('settings.auth.ssoDomains.domainAdded')
    ssoDomainMessageType.value = 'success'
  } catch (err: any) {
    ssoDomainMessage.value = err?.data?.message ?? err?.message ?? 'Kunde inte lägga till domänen.'
    ssoDomainMessageType.value = 'error'
  } finally {
    addingDomain.value = false
  }
}

const handleVerifyDomain = async (domain: string) => {
  if (!currentOrgId.value) return
  verifyingDomain.value = domain
  ssoDomainMessage.value = ''
  try {
    const response = await ($fetch as any)(
      `/api/organizations/sso-domains/${encodeURIComponent(domain)}/verify`,
      { method: 'POST' }
    )
    if (response.verified) {
      const entry = ssoDomains.value.find((d) => d.domain === domain)
      if (entry) {
        entry.verificationStatus = 'verified'
        entry.verifiedAt = new Date().toISOString()
      }
      ssoDomainMessage.value = t('settings.auth.ssoDomains.domainVerified')
      ssoDomainMessageType.value = 'success'
    } else {
      const entry = ssoDomains.value.find((d) => d.domain === domain)
      if (entry && response.expected) {
        entry.verificationInstructions = {
          recordName: response.expected.recordName,
          recordValue: response.expected.recordValue
        }
      }
      ssoDomainMessage.value = response.error ?? t('settings.auth.ssoDomains.verifyFailed')
      ssoDomainMessageType.value = 'error'
    }
  } catch (err: any) {
    ssoDomainMessage.value = err?.data?.message ?? err?.message ?? t('settings.auth.ssoDomains.verifyFailed')
    ssoDomainMessageType.value = 'error'
  } finally {
    verifyingDomain.value = null
  }
}

const handleRemoveDomain = async (domain: string) => {
  if (!currentOrgId.value) return
  if (!confirm(t('settings.auth.ssoDomains.confirmRemove'))) return
  removingDomain.value = domain
  ssoDomainMessage.value = ''
  try {
    await ($fetch as any)(
      `/api/organizations/sso-domains/${encodeURIComponent(domain)}`,
      { method: 'DELETE' }
    )
    ssoDomains.value = ssoDomains.value.filter((d) => d.domain !== domain)
    ssoDomainMessage.value = t('settings.auth.ssoDomains.domainRemoved')
    ssoDomainMessageType.value = 'success'
  } catch (err: any) {
    ssoDomainMessage.value = err?.data?.message ?? err?.message ?? 'Kunde inte ta bort domänen.'
    ssoDomainMessageType.value = 'error'
  } finally {
    removingDomain.value = null
  }
}

// Load SSO domains when org data is available
watch(
  () => currentOrgId.value,
  (orgId) => {
    if (orgId) {
      fetchSsoDomains()
    }
  },
  { immediate: true }
)
</script>
