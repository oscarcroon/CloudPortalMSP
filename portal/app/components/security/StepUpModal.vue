<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="handleCancel"
      >
        <div
          class="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl"
          @click.stop
        >
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-xl font-semibold text-white">{{ t('mfa.title') }}</h2>
            <button
              v-if="allowCancel"
              class="text-slate-400 transition hover:text-white"
              @click="handleCancel"
            >
              <Icon icon="mdi:close" class="h-5 w-5" />
            </button>
          </div>

          <p class="mb-6 text-sm text-slate-300">
            {{ t('mfa.subtitle') }}
          </p>

          <form @submit.prevent="handleSubmit">
            <div class="mb-4">
              <label for="mfa-code" class="mb-2 block text-sm font-medium text-slate-300">
                {{ t('mfa.codeLabel') }}
              </label>
              <input
                id="mfa-code"
                v-model="code"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="6"
                autocomplete="one-time-code"
                class="w-full rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-white placeholder:text-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                :placeholder="t('mfa.codePlaceholder')"
                :disabled="loading"
                @input="handleCodeInput"
              />
            </div>

            <div v-if="error" class="mb-4 rounded-md bg-red-500/10 border border-red-500/20 px-4 py-2 text-sm text-red-400">
              {{ error }}
            </div>

            <div class="flex items-center justify-end gap-3">
              <button
                v-if="allowCancel"
                type="button"
                class="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
                :disabled="loading"
                @click="handleCancel"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                type="submit"
                class="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-50"
                :disabled="loading || !isCodeValid"
              >
                <span v-if="loading">{{ t('mfa.verifying') }}</span>
                <span v-else>{{ t('mfa.verify') }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, useI18n } from '#imports'
import { Icon } from '@iconify/vue'

const { t } = useI18n()

interface Props {
  show: boolean
  allowCancel?: boolean
  scope: 'tenant' | 'org' | 'global'
  scopeId?: string
}

const props = withDefaults(defineProps<Props>(), {
  allowCancel: true
})

const emit = defineEmits<{
  verified: []
  cancelled: []
}>()

const code = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

const isCodeValid = computed(() => {
  return code.value.length === 6 && /^\d{6}$/.test(code.value)
})

function handleCodeInput(event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value.replace(/\D/g, '').slice(0, 6)
  code.value = value
  error.value = null
}

async function handleSubmit() {
  if (!isCodeValid.value || loading.value) {
    return
  }

  loading.value = true
  error.value = null

  try {
    const response = await ($fetch as any)('/api/auth/mfa/verify', {
      method: 'POST',
      body: {
        code: code.value,
        scope: props.scope,
        scopeId: props.scopeId,
        method: 'totp'
      },
      credentials: 'include'
    }) as { success: boolean; error?: string }

    if (response.success) {
      emit('verified')
      code.value = ''
      error.value = null
    } else {
      error.value = response.error === 'INVALID_MFA_CODE' 
        ? t('mfa.errors.invalidCode')
        : t('mfa.errors.verifyFailed')
    }
  } catch (err: any) {
    error.value = err.data?.message || t('mfa.errors.generic')
  } finally {
    loading.value = false
  }
}

function handleCancel() {
  if (!props.allowCancel || loading.value) {
    return
  }
  emit('cancelled')
  code.value = ''
  error.value = null
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>

