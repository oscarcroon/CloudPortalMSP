<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <NuxtLink
        to="/settings"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        ← Tillbaka till inställningar
      </NuxtLink>
      <div>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">E-postinställningar</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          Hantera organisationens egna utskick. Aktivera override för att använda egna SMTP-/Graph-inställningar,
          annars ärvs inställningarna från leverantör → distributör → global.
        </p>
      </div>
    </header>

    <div v-if="!currentOrgId" class="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-300">
      Du behöver välja en aktiv organisation innan du kan uppdatera e-postinställningarna.
    </div>

    <div
      v-else-if="!canManageEmail"
      class="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/5 dark:text-amber-200"
    >
      Du saknar behörigheten att uppdatera e-postinställningar för {{ organisationName }}. Be en ägare eller
      administratör (permisson <code class="rounded bg-black/10 px-1 text-xs">org:manage</code>) att justera detta åt dig.
    </div>

    <div v-else class="space-y-6">
      <div class="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        Aktiv organisation: <span class="font-semibold text-slate-900 dark:text-white">{{ organisationName }}</span>.
        Alla utskick (inbjudningar, rapporter m.m.) använder dessa inställningar när override är aktiv.
      </div>

      <div
        v-if="pending"
        class="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
      >
        Hämtar e-postinställningar...
      </div>

      <div
        v-if="!pending && !provider?.isActive"
        class="rounded-lg border border-slate-200 bg-blue-50/80 px-4 py-3 text-sm text-slate-600 dark:border-blue-500/10 dark:bg-blue-500/5 dark:text-slate-300"
      >
        <p class="font-medium text-slate-900 dark:text-white">E-postinställningar ärvs från högre nivå</p>
        <p class="mt-1 text-xs">
          Om inga egna inställningar är aktiverade används inställningarna från leverantör → distributör → global.
        </p>
      </div>

      <EmailProviderForm
        v-if="!pending"
        :summary="provider"
        mode="organization"
        :organization-id="currentOrgId"
        :saving="saving"
        :testing="testing"
        :status-message="formStatusMessage"
        :status-variant="formStatusVariant"
        :test-message="testMessage"
        :test-variant="testVariant"
        @submit="handleSave"
        @test="handleTest"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from '#imports'
import EmailProviderForm from '~/components/admin/EmailProviderForm.vue'
import { useAuth } from '~/composables/useAuth'
import { usePermission } from '~/composables/usePermission'
import type {
  AdminEmailProviderPayload,
  AdminEmailProviderSummary,
  AdminEmailProviderTestPayload
} from '~/types/admin'

definePageMeta({
  layout: 'default'
})

const auth = useAuth()
const permission = usePermission()

const currentOrgId = computed(() => auth.state.value.data?.currentOrgId ?? null)
const organisationName = computed(() => auth.currentOrg.value?.name ?? 'organisationen')
const canManageEmail = permission.can('org:manage')

const provider = ref<AdminEmailProviderSummary | null>(null)
const pending = ref(false)
const saving = ref(false)
const testing = ref(false)
const notification = ref('')
const errorMessage = ref('')
const testMessage = ref('')
const testVariant = ref<'success' | 'error'>('success')

const formStatusVariant = computed<'success' | 'error' | ''>(() => {
  if (errorMessage.value) return 'error'
  if (notification.value) return 'success'
  return ''
})
const formStatusMessage = computed(() => errorMessage.value || notification.value || '')

const loadProvider = async () => {
  if (!currentOrgId.value || !canManageEmail.value) {
    provider.value = null
    return
  }
  pending.value = true
  errorMessage.value = ''
  try {
    const response = await $fetch<{ provider: AdminEmailProviderSummary | null }>(
      '/api/settings/email-provider'
    )
    provider.value = response.provider
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : 'Kunde inte hämta e-postinställningarna.'
  } finally {
    pending.value = false
  }
}

watch(
  () => [currentOrgId.value, canManageEmail.value],
  () => {
    if (currentOrgId.value && canManageEmail.value) {
      void loadProvider()
    } else {
      provider.value = null
    }
  },
  { immediate: true }
)

const handleSave = async (payload: AdminEmailProviderPayload) => {
  if (saving.value || !currentOrgId.value || !canManageEmail.value) return
  notification.value = ''
  errorMessage.value = ''
  saving.value = true
  try {
    await $fetch('/api/settings/email-provider', {
      method: 'PUT',
      body: payload
    })
    await loadProvider()
    notification.value = 'E-postinställningen sparades.'
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Kunde inte spara e-postinställningen.'
  } finally {
    saving.value = false
  }
}

const handleTest = async (payload: AdminEmailProviderTestPayload) => {
  if (testing.value || !currentOrgId.value || !canManageEmail.value) return
  testMessage.value = ''
  testing.value = true
  try {
    await $fetch('/api/settings/email-provider/test', {
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


