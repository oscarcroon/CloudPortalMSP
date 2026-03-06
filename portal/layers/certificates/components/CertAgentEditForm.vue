<template>
  <Teleport to="body">
    <div
      v-if="isOpen && agent"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6"
      @click.self="close"
    >
      <div class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <header class="mb-4">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.agents.edit') }}</h3>
        </header>

        <form class="space-y-4" @submit.prevent="submit">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('certificates.agents.name') }}</label>
            <input v-model="form.name" type="text" required class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50" />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('certificates.agents.description') }}</label>
            <textarea v-model="form.description" rows="2" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50" />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('certificates.agents.status') }}</label>
            <select v-model="form.status" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50">
              <option value="active">{{ $t('certificates.agents.statuses.active') }}</option>
              <option value="inactive">{{ $t('certificates.agents.statuses.inactive') }}</option>
            </select>
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('certificates.agents.capabilities') }}</label>
            <div class="flex flex-wrap gap-2">
              <label v-for="cap in availableCapabilities" :key="cap" class="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200">
                <input v-model="selectedCapabilities" type="checkbox" :value="cap" class="rounded border-slate-300" />
                {{ cap }}
              </label>
            </div>
          </div>

          <p v-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>

          <div class="flex justify-end gap-2 pt-4">
            <button type="button" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-100" @click="close" :disabled="submitting">
              {{ $t('certificates.common.cancel') }}
            </button>
            <button type="submit" class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white" :disabled="submitting">
              <Icon v-if="submitting" icon="mdi:loading" class="h-4 w-4 animate-spin" />
              {{ $t('certificates.common.save') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const props = defineProps<{ isOpen: boolean; agent: any }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const availableCapabilities = ['http-01', 'dns-01', 'iis', 'pfx', 'centralssl']

const form = reactive({ name: '', description: '', status: 'active' as string })
const selectedCapabilities = ref<string[]>([])
const submitting = ref(false)
const error = ref<string | null>(null)

watch(() => props.agent, (a) => {
  if (a) {
    form.name = a.name
    form.description = a.description ?? ''
    form.status = a.status
    selectedCapabilities.value = a.capabilities?.supports ?? []
  }
}, { immediate: true })

const close = () => { error.value = null; emit('close') }

const submit = async () => {
  if (!props.agent) return
  submitting.value = true
  error.value = null
  try {
    await $fetch(`/api/certificates/agents/${props.agent.id}`, {
      method: 'PUT',
      body: {
        name: form.name,
        description: form.description || null,
        status: form.status,
        capabilities: { supports: selectedCapabilities.value, dnsProviders: [] }
      }
    })
    emit('saved')
  } catch (err: any) {
    error.value = err?.data?.message ?? 'Failed to update agent'
  } finally {
    submitting.value = false
  }
}
</script>
