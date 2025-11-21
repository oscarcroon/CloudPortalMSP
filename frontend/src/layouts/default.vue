<template>
  <div class="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-900 dark:text-slate-100">
    <TopBar />
    <MainNavbar />

    <main class="px-4 py-6 lg:px-10 max-w-6xl mx-auto w-full">
      <slot />
    </main>

    <footer class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
      © {{ new Date().getFullYear() }} Cloud Portal. All rights reserved.
    </footer>
  </div>
</template>

<script setup lang="ts">
import TopBar from '~/components/layout/TopBar.vue'
import MainNavbar from '~/components/layout/MainNavbar.vue'
import { useAuth } from '~/composables/useAuth'

const auth = useAuth()
if (import.meta.client) {
  await auth.bootstrap()
}
</script>

