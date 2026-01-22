<template>
  <div
    class="relative flex min-h-screen flex-col items-center justify-center bg-slate-50/70 text-slate-900 transition-colors dark:bg-slate-950/80 dark:text-slate-50"
  >
    <div class="absolute right-6 top-6">
      <ThemeToggle />
    </div>

    <main
      class="w-full max-w-4xl rounded-[2.5rem] border border-slate-200/80 bg-white/90 p-10 shadow-2xl shadow-slate-900/5 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-slate-900/40"
    >
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import ThemeToggle from '~/components/layout/ThemeToggle.vue'
</script>


