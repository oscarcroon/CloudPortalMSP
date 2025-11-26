<template>
  <div>
    <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {{ label }} <span v-if="required" class="text-red-500">*</span>
    </label>
    <select
      :value="modelValue"
      :required="required"
      class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">{{ placeholder }}</option>
      <option v-for="distributor in distributors" :key="distributor.id" :value="distributor.id">
        {{ distributor.name }} ({{ distributor.slug }})
      </option>
    </select>
    <p v-if="helpText" class="mt-1 text-xs text-slate-500 dark:text-slate-400">
      {{ helpText }}
    </p>
  </div>
</template>

<script setup lang="ts">
import type { AdminTenantSummary } from '~/types/admin'

const props = withDefaults(defineProps<{
  modelValue: string
  distributors: AdminTenantSummary[]
  required?: boolean
  helpText?: string
  label?: string
  placeholder?: string
}>(), {
  label: 'Distributör',
  placeholder: 'Välj distributör...'
})

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

