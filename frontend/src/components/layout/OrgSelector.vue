<template>
  <div ref="container" class="relative">
    <button
      class="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand"
      @click="toggle"
    >
      <span class="truncate max-w-[180px]">{{ currentOrgName }}</span>
      <svg
        class="h-4 w-4 text-white"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
          clip-rule="evenodd"
        />
      </svg>
    </button>

    <div
      v-if="open"
      class="absolute right-0 z-40 mt-2 w-72 rounded-lg border border-slate-700 bg-slate-900/95 p-2 shadow-xl backdrop-blur"
    >
      <p class="px-2 text-xs uppercase text-slate-400">Organisationer</p>
      <button
        v-for="org in auth.organizations.value"
        :key="org.id"
        class="mt-1 flex w-full items-start justify-between rounded-md px-2 py-2 text-left text-sm text-white transition hover:bg-white/10"
        :class="{
          'bg-white/10': auth.state.value.data?.currentOrgId === org.id
        }"
        @click="selectOrg(org.id)"
      >
        <div>
          <p class="font-semibold">{{ org.name }}</p>
          <p class="text-xs text-slate-400">{{ org.role }} • {{ org.status }}</p>
        </div>
        <span v-if="org.enforceSso" class="text-xs text-amber-400">SSO</span>
      </button>

      <p v-if="!auth.organizations.value.length" class="px-2 py-4 text-sm text-slate-400">
        Inga organisationer kopplade till kontot.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from '#imports'
import { useAuth } from '~/composables/useAuth'

const auth = useAuth()
const open = ref(false)
const container = ref<HTMLElement>()

const currentOrgName = computed(
  () => auth.currentOrg.value?.name ?? 'Välj organisation'
)

function toggle() {
  open.value = !open.value
}

async function selectOrg(orgId: string) {
  await auth.switchOrganization(orgId)
  open.value = false
}

function handleGlobalClick(event: MouseEvent) {
  if (!open.value || !container.value) {
    return
  }
  const target = event.target as Node | null
  if (!target || container.value.contains(target)) {
    return
  }
  open.value = false
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleGlobalClick)
})
</script>

