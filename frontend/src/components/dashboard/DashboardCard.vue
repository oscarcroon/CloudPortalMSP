<template>
  <div
    :class="[
      'flex h-full flex-col justify-between rounded-2xl border border-transparent bg-white/90 p-5 shadow-card transition dark:border-slate-700 dark:bg-slate-800',
      disabled
        ? 'opacity-50 cursor-not-allowed grayscale'
        : 'hover:-translate-y-1 hover:shadow-xl cursor-pointer'
    ]"
    :role="disabled ? 'presentation' : 'button'"
    :tabindex="disabled ? -1 : 0"
    @click="!disabled && $emit('select')"
    @keyup.enter="!disabled && $emit('select')"
  >
    <div>
      <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ badge }}</p>
      <div class="mt-2 flex items-center gap-3">
        <Icon v-if="icon" :icon="icon" :class="['h-8 w-8', disabled ? 'text-slate-400' : 'text-brand']" />
        <h3 :class="['text-2xl font-semibold', disabled ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100']">
          {{ title }}
        </h3>
      </div>
      <p :class="['mt-3 text-sm', disabled ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-300']">
        {{ description }}
      </p>
      <p v-if="disabled" class="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
        Modulen är avaktiverad
      </p>
    </div>
    <div v-if="!disabled" class="mt-6 flex items-center justify-between text-brand">
      <span class="text-sm font-semibold">Öppna modul</span>
      <span aria-hidden="true">⟶</span>
    </div>
    <div v-else class="mt-6 flex items-center justify-between text-slate-400">
      <span class="text-sm font-semibold">Ej tillgänglig</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  badge: {
    type: String,
    default: 'Modul'
  },
  icon: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

defineEmits(['select'])
</script>

