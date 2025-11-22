<template>
  <nav class="flex flex-wrap gap-2">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.key"
      :to="`/admin/organizations/${slug}/${tab.key}`"
      class="rounded-full border px-4 py-1 text-sm font-semibold transition"
      :class="tabClass(tab.key)"
    >
      {{ tab.label }}
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
const props = defineProps<{
  slug: string
  active: 'overview' | 'members' | 'auth' | 'email'
}>()

const tabs = [
  { key: 'overview', label: 'Översikt' },
  { key: 'members', label: 'Medlemmar' },
  { key: 'auth', label: 'Auth & SSO' },
  { key: 'email', label: 'E-post' }
]

const tabClass = (key: string) => {
  const base = 'border-slate-200 text-slate-600 hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200'
  if (props.active === key) {
    return 'border-brand bg-brand/10 text-brand dark:border-brand/80 dark:bg-brand/10 dark:text-brand/80'
  }
  return base
}
</script>

