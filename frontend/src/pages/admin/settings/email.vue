<template>
  <section class="space-y-6">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Global e-postprovider</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        Konfigurera det globala utskicket som används för lösenord, inbjudningar och andra notifieringar.
      </p>
    </header>

    <div v-if="notification" class="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
      {{ notification }}
    </div>
    <div v-if="errorMessage" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
      {{ errorMessage }}
    </div>

    <div v-if="pending" class="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
      Hämtar inställningar...
    </div>

    <EmailProviderForm
      v-else
      :summary="provider"
      mode="global"
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
import { computed, ref, useFetch } from '#imports'
import EmailProviderForm from '~/components/admin/EmailProviderForm.vue'
import type { AdminEmailProviderSummary, AdminEmailProviderPayload, AdminEmailProviderTestPayload } from '~/types/admin'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const notification = ref('')
const errorMessage = ref('')
const saving = ref(false)
const testing = ref(false)
const testMessage = ref('')
const testVariant = ref<'success' | 'error'>('success')

const { data, pending, refresh, error } = await useFetch<{ provider: AdminEmailProviderSummary | null }>(
  '/api/admin/email-provider'
)

if (error.value) {
  errorMessage.value = error.value.message
}

const provider = computed(() => data.value?.provider ?? null)

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
    await $fetch('/api/admin/email-provider', {
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
    await $fetch('/api/admin/email-provider/test', {
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

