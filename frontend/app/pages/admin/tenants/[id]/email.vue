<template>
  <section class="space-y-6">
    <header class="space-y-2">
      <NuxtLink
        :to="`/admin/tenants/${tenantId}`"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        ← Tillbaka till tenant
      </NuxtLink>
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          E-postinställningar - {{ tenant?.name ?? 'Laddar...' }}
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          <span v-if="tenant?.type === 'provider'">
            Leverantör - Dessa inställningar ärvs av alla distributörer och organisationer under denna leverantör.
          </span>
          <span v-else-if="tenant?.type === 'distributor'">
            Distributör - Dessa inställningar ärvs av alla organisationer under denna distributör.
          </span>
        </p>
      </div>
    </header>

    <div v-if="notification" class="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
      {{ notification }}
    </div>
    <div v-if="errorMessage" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
      {{ errorMessage }}
    </div>

    <div
      v-if="pending"
      class="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
    >
      Hämtar inställningar...
    </div>

    <EmailProviderChainCard v-if="!pending && chain.length" :chain="chain" />

    <EmailProviderForm
      v-if="!pending"
      :summary="provider"
      :mode="tenant?.type === 'provider' ? 'provider' : 'distributor'"
      :tenant-id="tenantId"
      :saving="saving"
      :testing="testing"
      :status-message="formStatusMessage"
      :status-variant="formStatusVariant"
      :test-message="testMessage"
      :test-variant="testVariant"
      @submit="handleSave"
      @test="handleTest"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useFetch, useRoute } from '#imports'
import EmailProviderForm from '~/components/admin/EmailProviderForm.vue'
import EmailProviderChainCard from '~/components/email/EmailProviderChainCard.vue'
import type {
  AdminEmailProviderSummary,
  AdminEmailProviderPayload,
  AdminEmailProviderTestPayload,
  EmailProviderChainEntry
} from '~/types/admin'

definePageMeta({
  layout: 'default'
})

const route = useRoute()
const tenantId = route.params.id as string

const notification = ref('')
const errorMessage = ref('')
const saving = ref(false)
const testing = ref(false)
const testMessage = ref('')
const testVariant = ref<'success' | 'error'>('success')

// Fetch tenant info
const { data: tenantData } = await useFetch<{ tenant: { id: string; name: string; type: string } }>(
  `/api/admin/tenants/${tenantId}`
)

const tenant = computed(() => tenantData.value?.tenant)

// Fetch email provider
const { data, pending, refresh, error } = await useFetch<{
  provider: AdminEmailProviderSummary | null
  chain: EmailProviderChainEntry[]
}>(
  `/api/admin/tenants/${tenantId}/email-provider`
)

if (error.value) {
  errorMessage.value = error.value.message
}

const provider = computed(() => data.value?.provider ?? null)
const chain = computed(() => data.value?.chain ?? [])

const formStatusVariant = computed<'success' | 'error' | ''>(() => {
  if (errorMessage.value) return 'error'
  if (notification.value) return 'success'
  return ''
})

const formStatusMessage = computed(() => errorMessage.value || notification.value || '')

const handleSave = async (payload: AdminEmailProviderPayload) => {
  if (saving.value) return
  notification.value = ''
  errorMessage.value = ''
  saving.value = true
  try {
    await $fetch(`/api/admin/tenants/${tenantId}/email-provider`, {
      method: 'PUT',
      body: payload
    })
    await refresh()
    notification.value = 'Inställningarna sparades.'
    testMessage.value = ''
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Kunde inte spara inställningarna.'
  } finally {
    saving.value = false
  }
}

const handleTest = async (payload: AdminEmailProviderTestPayload) => {
  if (testing.value) return
  testMessage.value = ''
  testing.value = true
  try {
    await $fetch(`/api/admin/tenants/${tenantId}/email-provider/test`, {
      method: 'POST',
      body: payload
    })
    testVariant.value = 'success'
    testMessage.value = `Testmail skickades till ${payload.testEmail}.`
  } catch (err) {
    testVariant.value = 'error'
    testMessage.value = err instanceof Error ? err.message : 'Kunde inte skicka testmail.'
  } finally {
    testing.value = false
  }
}
</script>

