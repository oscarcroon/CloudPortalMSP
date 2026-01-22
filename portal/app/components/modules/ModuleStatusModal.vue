<template>
  <teleport to="body">
    <div
      v-if="open && module"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
      @click.self="handleClose"
    >
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
              {{ t('modules.statusModal.title') }}
            </p>
            <h2 class="text-xl font-semibold text-slate-900 dark:text-white">
              {{ module.name }}
            </h2>
          </div>
          <button
            type="button"
            class="text-slate-500 transition hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
            @click="handleClose"
          >
            <Icon icon="mdi:close" class="h-5 w-5" />
          </button>
        </div>

        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {{ t('modules.statusModal.description') }}
        </p>

        <div class="mt-6 space-y-4">
          <!-- Status options -->
          <div class="space-y-3">
            <label
              class="flex items-start gap-3 rounded-lg border p-4 transition"
              :class="
                status === 'active'
                  ? 'border-brand bg-brand/5 dark:border-brand/50 dark:bg-brand/10'
                  : 'border-slate-200 dark:border-white/10'
              "
            >
              <input
                v-model="status"
                type="radio"
                value="active"
                class="mt-1 h-4 w-4 text-brand focus:ring-brand dark:border-white/20"
              />
              <div class="flex-1">
                <p class="font-semibold text-slate-900 dark:text-white">
                  {{ t('modules.statusModal.options.active.title') }}
                </p>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {{ t('modules.statusModal.options.active.description') }}
                </p>
              </div>
            </label>

            <label
              class="flex items-start gap-3 rounded-lg border p-4 transition"
              :class="
                status === 'disabled'
                  ? 'border-brand bg-brand/5 dark:border-brand/50 dark:bg-brand/10'
                  : 'border-slate-200 dark:border-white/10'
              "
            >
              <input
                v-model="status"
                type="radio"
                value="disabled"
                class="mt-1 h-4 w-4 text-brand focus:ring-brand dark:border-white/20"
              />
              <div class="flex-1">
                <p class="font-semibold text-slate-900 dark:text-white">
                  {{ t('modules.statusModal.options.disabled.title') }}
                </p>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {{ t('modules.statusModal.options.disabled.description') }}
                </p>
              </div>
            </label>

            <label
              class="flex items-start gap-3 rounded-lg border p-4 transition"
              :class="
                status === 'hidden'
                  ? 'border-brand bg-brand/5 dark:border-brand/50 dark:bg-brand/10'
                  : 'border-slate-200 dark:border-white/10'
              "
            >
              <input
                v-model="status"
                type="radio"
                value="hidden"
                class="mt-1 h-4 w-4 text-brand focus:ring-brand dark:border-white/20"
              />
              <div class="flex-1">
                <p class="font-semibold text-slate-900 dark:text-white">
                  {{ t('modules.statusModal.options.hidden.title') }}
                </p>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {{ t('modules.statusModal.options.hidden.description') }}
                </p>
              </div>
            </label>

            <label
              class="flex items-start gap-3 rounded-lg border p-4 transition"
              :class="
                status === 'coming-soon'
                  ? 'border-brand bg-brand/5 dark:border-brand/50 dark:bg-brand/10'
                  : 'border-slate-200 dark:border-white/10'
              "
            >
              <input
                v-model="status"
                type="radio"
                value="coming-soon"
                class="mt-1 h-4 w-4 text-brand focus:ring-brand dark:border-white/20"
              />
              <div class="flex-1">
                <p class="font-semibold text-slate-900 dark:text-white">
                  {{ t('modules.statusModal.options.comingSoon.title') }}
                </p>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {{ t('modules.statusModal.options.comingSoon.description') }}
                </p>
              </div>
            </label>
          </div>

          <!-- Coming soon message input -->
          <div v-if="status === 'coming-soon'" class="space-y-2">
            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              {{ t('modules.statusModal.comingSoonMessage.label') }}
            </label>
            <textarea
              v-model="comingSoonMessage"
              :placeholder="t('modules.statusModal.comingSoonMessage.placeholder')"
              rows="3"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white dark:placeholder:text-slate-500"
            />
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('modules.statusModal.comingSoonMessage.hint') }}
            </p>
          </div>
        </div>

        <div v-if="error" class="mt-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {{ error }}
        </div>

        <div class="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-white"
            @click="handleClose"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-600 disabled:opacity-60"
            :disabled="saving"
            @click="handleSave"
          >
            <Icon v-if="saving" icon="mdi:loading" class="h-4 w-4 animate-spin" />
            <Icon v-else icon="mdi:content-save" class="h-4 w-4" />
            {{ t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from '#imports'
import type { ModuleStatusDto } from '~/types/modules'

const props = defineProps<{
  open: boolean
  module: ModuleStatusDto | null
  currentEnabled?: boolean
  currentDisabled?: boolean
  currentComingSoonMessage?: string | null
}>()

const emit = defineEmits<{
  close: []
  save: [data: { enabled: boolean; disabled: boolean; comingSoonMessage: string | null }]
}>()

const { t } = useI18n()

const status = ref<'active' | 'disabled' | 'hidden' | 'coming-soon'>('active')
const comingSoonMessage = ref('')
const saving = ref(false)
const error = ref<string | null>(null)

// Initialize from props
watch(
  () => [props.open, props.currentEnabled, props.currentDisabled, props.currentComingSoonMessage],
  ([open, enabled, disabled, message]) => {
    if (open) {
      if (message && disabled) {
        status.value = 'coming-soon'
        comingSoonMessage.value = message
      } else if (disabled) {
        status.value = 'disabled'
        comingSoonMessage.value = ''
      } else if (enabled === false) {
        status.value = 'hidden'
        comingSoonMessage.value = ''
      } else {
        status.value = 'active'
        comingSoonMessage.value = ''
      }
      error.value = null
    }
  },
  { immediate: true }
)

const handleClose = () => {
  if (!saving.value) {
    emit('close')
  }
}

const handleSave = () => {
  saving.value = true
  error.value = null

  let enabled = true
  let disabled = false
  let message: string | null = null

  switch (status.value) {
    case 'active':
      enabled = true
      disabled = false
      message = null
      break
    case 'disabled':
      enabled = true
      disabled = true
      message = null
      break
    case 'hidden':
      enabled = false
      disabled = false
      message = null
      break
    case 'coming-soon':
      enabled = true
      disabled = true
      message = comingSoonMessage.value.trim() || null
      break
  }

  emit('save', { enabled, disabled, comingSoonMessage: message })
  saving.value = false
}
</script>


