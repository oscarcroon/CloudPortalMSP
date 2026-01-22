<template>
  <section class="space-y-6">
    <header class="space-y-1">
      <NuxtLink to="/platform-admin/organizations" class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500">
        ← Tillbaka till listan
      </NuxtLink>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">E-postinställningar</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">Åsidosätt den globala e-postprovidern för denna organisation.</p>
    </header>

    <OrganizationTabs :slug="slug" active="email" />

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
      mode="organization"
      :organization-id="data?.organization?.id"
      :saving="saving"
      :testing="testing"
      @submit="handleSave"
      @test="handleTest"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useFetch, useRoute } from '#imports'
import EmailProviderForm from '~/components/admin/EmailProviderForm.vue'
import EmailProviderChainCard from '~/components/email/EmailProviderChainCard.vue'
import OrganizationTabs from '~/components/admin/OrganizationTabs.vue'
import type {
  AdminEmailProviderPayload,
  AdminEmailProviderSummary,
  AdminEmailProviderTestPayload,
  EmailProviderChainEntry
} from '~/types/admin'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const route = useRoute()
const slug = computed(() => route.params.slug as string)
const notification = ref('')
const errorMessage = ref('')
const saving = ref(false)
const testing = ref(false)

const { data, pending, refresh, error } = await useFetch<{
  organization: { id: string; name: string }
  provider: AdminEmailProviderSummary | null
  chain: EmailProviderChainEntry[]
}>(
  `/api/admin/organizations/${slug.value}/email-provider`,
  { watch: [slug] }
)

if (error.value) {
  errorMessage.value = error.value.message
}

const provider = computed(() => data.value?.provider ?? null)
const chain = computed(() => data.value?.chain ?? [])

const handleSave = async (payload: AdminEmailProviderPayload) => {
  if (saving.value) return
  notification.value = ''
  errorMessage.value = ''
  saving.value = true
  try {
    await $fetch(`/api/admin/organizations/${slug.value}/email-provider`, {
      method: 'PUT',
      body: payload
    })
    await refresh()
    notification.value = 'E-postinställningen sparades.'
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Kunde inte spara inställningen.'
  } finally {
    saving.value = false
  }
}

const handleTest = async (payload: AdminEmailProviderTestPayload) => {
  if (testing.value) return
  errorMessage.value = ''
  testing.value = true
  try {
    await $fetch(`/api/admin/organizations/${slug.value}/email-provider/test`, {
      method: 'POST',
      body: payload
    })
    notification.value = `Testmail skickades till ${payload.testEmail}.`
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Kunde inte skicka testmail.'
  } finally {
    testing.value = false
  }
}
</script>

