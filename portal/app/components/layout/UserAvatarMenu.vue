<template>
  <div class="relative" ref="container">
    <button
      type="button"
      class="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-transparent transition focus:outline-none"
      :style="{ backgroundColor: avatarBgColor }"
      :aria-label="t('topBar.avatarMenu')"
      :title="t('topBar.avatarMenu')"
      aria-haspopup="true"
      :aria-expanded="open"
      @click="toggle"
    >
      <img
        v-if="profilePictureUrl && !imgError"
        :src="profilePictureUrl"
        :alt="displayName"
        class="h-full w-full rounded-full object-cover"
        @error="imgError = true"
      />
      <span
        v-else-if="initials"
        class="text-xs font-semibold leading-none text-white select-none"
      >
        {{ initials }}
      </span>
      <svg
        v-else
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4 text-white"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path
          d="M12 3a5 5 0 0 1 3.187 8.871A8 8 0 0 1 20 19.25a.75.75 0 0 1-1.5 0 6.5 6.5 0 0 0-13 0 .75.75 0 0 1-1.5 0 8 8 0 0 1 4.814-7.379A5 5 0 0 1 12 3Zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
        />
      </svg>
    </button>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 -translate-y-1"
    >
      <div
        v-if="open"
        role="menu"
        class="absolute right-0 top-full z-[60] mt-2 min-w-[220px] rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800"
        @click.stop
      >
        <!-- User info -->
        <div class="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
          <p class="truncate text-sm font-medium text-slate-900 dark:text-white">
            {{ displayName }}
          </p>
          <p
            v-if="currentUser?.fullName"
            class="truncate text-xs text-slate-500 dark:text-slate-400"
          >
            {{ currentUser.email }}
          </p>
        </div>

        <!-- Menu items -->
        <div class="p-1">
          <NuxtLink
            to="/profile"
            role="menuitem"
            class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
            @click="open = false"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3a5 5 0 0 1 3.187 8.871A8 8 0 0 1 20 19.25a.75.75 0 0 1-1.5 0 6.5 6.5 0 0 0-13 0 .75.75 0 0 1-1.5 0 8 8 0 0 1 4.814-7.379A5 5 0 0 1 12 3Z" />
            </svg>
            {{ t('topBar.viewProfile') }}
          </NuxtLink>

          <button
            type="button"
            role="menuitem"
            class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            @click="handleLogout"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {{ t('topBar.logout') }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from '#imports'
import { useI18n } from '#imports'
import { useAuth } from '~/composables/useAuth'

const auth = useAuth()
const { t } = useI18n()

const open = ref(false)
const imgError = ref(false)
const container = ref<HTMLElement>()

const currentUser = computed(() => auth.user.value)

const profilePictureUrl = computed(() => currentUser.value?.profilePictureUrl ?? null)

const accentColor = computed(() => {
  return auth.branding.value?.activeTheme.accentColor || '#1C6DD0'
})

const avatarBgColor = computed(() => accentColor.value)

const displayName = computed(() => {
  return currentUser.value?.fullName || currentUser.value?.email || ''
})

const initials = computed(() => {
  const name = currentUser.value?.fullName
  if (!name?.trim()) {
    return currentUser.value?.email?.[0]?.toUpperCase() ?? null
  }
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
})

const toggle = () => {
  open.value = !open.value
}

const handleLogout = async () => {
  open.value = false
  await auth.logout()
  await navigateTo('/login')
}

const handleClickOutside = (event: MouseEvent) => {
  if (container.value && !container.value.contains(event.target as Node)) {
    open.value = false
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && open.value) {
    open.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
</script>
