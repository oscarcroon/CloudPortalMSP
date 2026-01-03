<template>
  <section class="space-y-6">
    <header>
      <NuxtLink
        to="/tenant-admin/operations/incidents"
        class="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <Icon icon="mdi:arrow-left" class="h-4 w-4" />
        {{ t('admin.tenantAdmin.operations.backToIncidents') }}
      </NuxtLink>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">
        {{ t('admin.tenantAdmin.operations.createIncident') }}
      </h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {{ t('admin.tenantAdmin.operations.createIncidentDesc') }}
      </p>
    </header>

    <form @submit.prevent="handleSubmit" class="max-w-2xl space-y-6">
      <!-- Title -->
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {{ t('admin.tenantAdmin.operations.incidentTitle') }} *
        </label>
        <input
          v-model="form.title"
          type="text"
          required
          maxlength="200"
          class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-brand focus:ring-brand dark:border-white/20 dark:bg-slate-800 dark:text-slate-100"
          :placeholder="t('admin.tenantAdmin.operations.incidentTitlePlaceholder')"
        />
      </div>

      <!-- Severity -->
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {{ t('admin.tenantAdmin.operations.severity') }}
        </label>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            v-for="sev in severityOptions"
            :key="sev.value"
            type="button"
            class="rounded-lg border px-3 py-2 text-sm font-medium transition"
            :class="form.severity === sev.value ? sev.activeClass : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'"
            @click="form.severity = sev.value"
          >
            <Icon :icon="sev.icon" class="inline h-4 w-4 mr-1" />
            {{ sev.label }}
          </button>
        </div>
      </div>

      <!-- Time window -->
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {{ t('admin.tenantAdmin.operations.startsAt') }}
          </label>
          <input
            v-model="form.startsAt"
            type="datetime-local"
            class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-brand focus:ring-brand dark:border-white/20 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {{ t('admin.tenantAdmin.operations.endsAt') }}
          </label>
          <input
            v-model="form.endsAt"
            type="datetime-local"
            class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-brand focus:ring-brand dark:border-white/20 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      <!-- Body -->
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {{ t('admin.tenantAdmin.operations.description') }}
        </label>
        <textarea
          v-model="form.bodyMarkdown"
          rows="6"
          maxlength="10000"
          class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-brand focus:ring-brand dark:border-white/20 dark:bg-slate-800 dark:text-slate-100"
          :placeholder="t('admin.tenantAdmin.operations.descriptionPlaceholder')"
        />
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {{ t('admin.tenantAdmin.operations.markdownSupported') }}
        </p>
      </div>

      <!-- Error message -->
      <div v-if="error" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
        {{ error }}
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3">
        <button
          type="submit"
          :disabled="submitting || !form.title.trim()"
          class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon v-if="submitting" icon="mdi:loading" class="h-4 w-4 animate-spin" />
          <Icon v-else icon="mdi:check" class="h-4 w-4" />
          {{ t('admin.tenantAdmin.operations.publish') }}
        </button>
        <NuxtLink
          to="/tenant-admin/operations/incidents"
          class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          {{ t('common.cancel') }}
        </NuxtLink>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n, useRouter } from '#imports'
import { Icon } from '@iconify/vue'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'default'
})

const { t } = useI18n()
const router = useRouter()
const auth = useAuth()

const currentTenant = computed(() => auth.currentTenant.value)
const tenantId = computed(() => currentTenant.value?.id)

const form = ref({
  title: '',
  severity: 'notice' as 'critical' | 'outage' | 'notice' | 'maintenance',
  bodyMarkdown: '',
  startsAt: '',
  endsAt: ''
})

const submitting = ref(false)
const error = ref<string | null>(null)

const severityOptions = [
  { value: 'critical' as const, label: t('operations.severity.critical'), icon: 'mdi:alert-circle', activeClass: 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/20 dark:text-red-300' },
  { value: 'outage' as const, label: t('operations.severity.outage'), icon: 'mdi:alert', activeClass: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/50 dark:bg-orange-500/20 dark:text-orange-300' },
  { value: 'maintenance' as const, label: t('operations.severity.maintenance'), icon: 'mdi:wrench', activeClass: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/20 dark:text-blue-300' },
  { value: 'notice' as const, label: t('operations.severity.notice'), icon: 'mdi:information', activeClass: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/20 dark:text-amber-300' }
]

async function handleSubmit() {
  if (!tenantId.value || !form.value.title.trim()) return

  submitting.value = true
  error.value = null

  try {
    const payload: Record<string, any> = {
      title: form.value.title.trim(),
      severity: form.value.severity,
      bodyMarkdown: form.value.bodyMarkdown.trim() || null
    }

    if (form.value.startsAt) {
      payload.startsAt = new Date(form.value.startsAt).toISOString()
    }
    if (form.value.endsAt) {
      payload.endsAt = new Date(form.value.endsAt).toISOString()
    }

    await $fetch(`/api/admin/tenants/${tenantId.value}/incidents`, {
      method: 'POST',
      body: payload,
      credentials: 'include'
    })

    router.push('/tenant-admin/operations/incidents')
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Failed to create incident'
  } finally {
    submitting.value = false
  }
}
</script>

