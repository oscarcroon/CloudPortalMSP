<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6"
      @click.self="close"
    >
      <div class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <header class="mb-4 space-y-1">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">
            {{ credentialSet ? $t('certificates.credentialSets.edit') : $t('certificates.credentialSets.create') }}
          </h3>
        </header>

        <form class="space-y-4" @submit.prevent="submit">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('certificates.credentialSets.name') }}</label>
            <input v-model="form.name" type="text" required class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50" />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('certificates.credentialSets.provider') }}</label>
            <select v-model="form.provider" required class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50">
              <option value="digicert">DigiCert</option>
              <option value="letsencrypt">Let's Encrypt</option>
              <option value="zerossl">ZeroSSL</option>
              <option value="custom">Custom ACME</option>
            </select>
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('certificates.credentialSets.acmeDirectory') }}</label>
            <input v-model="form.acmeDirectoryUrl" type="url" required class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50" />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('certificates.credentialSets.defaultValidation') }}</label>
            <select v-model="form.defaultValidationMethod" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50">
              <option value="">—</option>
              <option value="http-01">HTTP-01</option>
              <option value="dns-01">DNS-01</option>
            </select>
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('certificates.credentialSets.eabKid') }}</label>
            <input v-model="form.eabKid" type="text" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50" />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('certificates.credentialSets.eabHmac') }}</label>
            <input v-model="form.eabHmac" type="password" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50" :placeholder="credentialSet ? '(unchanged)' : ''" />
          </div>

          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input v-model="form.isDefault" type="checkbox" class="rounded border-slate-300" />
              {{ $t('certificates.credentialSets.isDefault') }}
            </label>
            <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input v-model="form.isActive" type="checkbox" class="rounded border-slate-300" />
              {{ $t('certificates.credentialSets.isActive') }}
            </label>
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

const props = defineProps<{
  isOpen: boolean
  credentialSet?: any
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const submitting = ref(false)
const error = ref<string | null>(null)

const form = reactive({
  name: '',
  provider: 'digicert' as string,
  acmeDirectoryUrl: '',
  defaultValidationMethod: '' as string,
  eabKid: '',
  eabHmac: '',
  isDefault: false,
  isActive: true
})

watch(() => props.credentialSet, (cs) => {
  if (cs) {
    form.name = cs.name
    form.provider = cs.provider
    form.acmeDirectoryUrl = cs.acmeDirectoryUrl
    form.defaultValidationMethod = cs.defaultValidationMethod ?? ''
    form.eabKid = cs.eabKid ?? ''
    form.eabHmac = ''
    form.isDefault = cs.isDefault
    form.isActive = cs.isActive
  } else {
    form.name = ''
    form.provider = 'digicert'
    form.acmeDirectoryUrl = ''
    form.defaultValidationMethod = ''
    form.eabKid = ''
    form.eabHmac = ''
    form.isDefault = false
    form.isActive = true
  }
}, { immediate: true })

const close = () => {
  error.value = null
  emit('close')
}

const submit = async () => {
  submitting.value = true
  error.value = null
  try {
    const body: any = { ...form }
    if (!body.defaultValidationMethod) delete body.defaultValidationMethod
    if (!body.eabKid) delete body.eabKid
    if (!body.eabHmac) delete body.eabHmac

    if (props.credentialSet) {
      await $fetch(`/api/certificates/credential-sets/${props.credentialSet.id}`, { method: 'PUT', body })
    } else {
      await $fetch('/api/certificates/credential-sets', { method: 'POST', body })
    }
    emit('saved')
  } catch (err: any) {
    error.value = err?.data?.message ?? err?.message ?? 'Failed to save'
  } finally {
    submitting.value = false
  }
}
</script>
