<template>
  <div
    :class="[
      'relative flex h-full flex-col justify-between rounded-2xl border border-transparent bg-white/90 p-5 shadow-card transition dark:border-slate-700 dark:bg-slate-800',
      disabled
        ? 'opacity-50 cursor-not-allowed grayscale'
        : 'hover:-translate-y-1 hover:shadow-xl cursor-pointer'
    ]"
    :role="disabled ? 'presentation' : 'button'"
    :tabindex="disabled ? -1 : 0"
    @click="!disabled && $emit('select')"
    @keyup.enter="!disabled && $emit('select')"
  >
    <button
      class="absolute right-4 top-4 flex items-center justify-center rounded-full border border-slate-200 bg-white/80 p-2 text-slate-400 transition hover:text-brand disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900/80"
      :class="isFavorite ? 'text-brand' : ''"
      :aria-pressed="isFavorite"
      :title="isFavorite ? 'Ta bort från favoriter' : 'Lägg till i favoriter'"
      :disabled="favoriteDisabled"
      @click.stop="$emit('toggle-favorite')"
    >
      <Icon :icon="isFavorite ? 'mdi:star' : 'mdi:star-outline'" class="h-4 w-4" />
      <span class="sr-only">
        {{ isFavorite ? 'Ta bort modul från favoriter' : 'Lägg till modul i favoriter' }}
      </span>
    </button>
    <div class="pr-8">
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
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  favoriteDisabled: {
    type: Boolean,
    default: false
  }
})

defineEmits(['select', 'toggle-favorite'])
</script>

