<template>
  <div
    class="flex h-full flex-col justify-between rounded-2xl border border-transparent bg-white/90 p-5 shadow-card transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-700 dark:bg-slate-800"
    role="button"
    tabindex="0"
    @click="$emit('select')"
    @keyup.enter="$emit('select')"
  >
    <div>
      <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ badge }}</p>
      <h3 class="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{{ title }}</h3>
      <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">
        {{ description }}
      </p>
    </div>
    <div class="mt-6 flex items-center justify-between text-brand">
      <span class="text-sm font-semibold">Öppna modul</span>
      <span aria-hidden="true">⟶</span>
    </div>
  </div>
</template>

<script setup lang="ts">
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
  }
})

defineEmits(['select'])
</script>

