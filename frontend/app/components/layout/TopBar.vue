<template>
  <header
    class="border-b border-[var(--surface-border)] bg-[var(--surface-topbar)] shadow-sm backdrop-blur transition-colors"
  >
    <div
      class="relative mx-auto flex w-full flex-wrap items-center gap-4 px-4 py-2 text-sm text-slate-700 dark:text-slate-100 lg:max-w-6xl"
    >
      <!-- Desktop: Sökfält -->
      <div class="hidden flex-1 md:block">
        <label class="sr-only" for="global-search">{{ t('topBar.searchLabel') }}</label>
          <input
            id="global-search"
            v-model="search"
            type="search"
            :placeholder="t('topBar.searchPlaceholder')"
            class="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 transition placeholder:text-slate-400 focus:outline-none focus:ring-1 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500"
            :style="{ '--tw-ring-color': accentColor }"
            @focus="(e: FocusEvent) => { const el = e.target as HTMLInputElement; el.style.borderColor = accentColor; el.style.setProperty('--tw-ring-color', accentColor) }"
            @blur="(e: FocusEvent) => { const el = e.target as HTMLInputElement; el.style.borderColor = '' }"
          />
      </div>

      <!-- Mobil: Tre sektioner (vänster, mitten, höger) -->
      <div class="flex w-full items-center justify-between md:hidden">
        <!-- Vänster: Sök-ikon + Docs-ikon -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            :aria-pressed="mobileSearchOpen"
            :aria-label="mobileSearchOpen ? t('topBar.toggleSearchClose') : t('topBar.toggleSearchOpen')"
            aria-controls="mobile-search-panel"
            @click="toggleMobileSearch"
            @mouseenter="(e: MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = accentColor; el.style.color = accentColor }"
            @mouseleave="(e: MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = ''; el.style.color = '' }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none">
              <path
                d="M11 4a7 7 0 0 1 5.523 11.205l3.636 3.636a1 1 0 0 1-1.414 1.414l-3.636-3.636A7 7 0 1 1 11 4Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"
                fill="currentColor"
                fill-rule="evenodd"
                clip-rule="evenodd"
              />
            </svg>
            <span class="sr-only">
              {{ mobileSearchOpen ? t('topBar.toggleSearchClose') : t('topBar.toggleSearchOpen') }}
            </span>
          </button>
          <NuxtLink
            to="/docs"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            :aria-label="t('topBar.docs')"
            :title="t('topBar.docs')"
            @mouseenter="(e: MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = accentColor; el.style.color = accentColor }"
            @mouseleave="(e: MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = ''; el.style.color = '' }"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
              <path d="M14 3v5h5" />
              <path d="M9 13h6" />
              <path d="M9 17h4" />
            </svg>
          </NuxtLink>
        </div>

        <!-- Mitten: Språkväxlare + Tema toggle -->
        <div class="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <!-- Höger: Profil-ikon -->
        <NuxtLink
          to="/profile"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-white transition"
          :style="{ backgroundColor: accentColor }"
          :class="{ 'hover:opacity-90': true }"
          :aria-label="t('topBar.profile')"
          :title="t('topBar.profile')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3a5 5 0 0 1 3.187 8.871A8 8 0 0 1 20 19.25a.75.75 0 0 1-1.5 0 6.5 6.5 0 0 0-13 0 .75.75 0 0 1-1.5 0 8 8 0 0 1 4.814-7.379A5 5 0 0 1 12 3Zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
              fill="currentColor"
            />
          </svg>
        </NuxtLink>
      </div>

      <!-- Desktop: Höger sektion -->
      <div class="hidden items-center gap-2 md:flex">
        <NuxtLink
          to="/docs"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          :aria-label="t('topBar.docs')"
          :title="t('topBar.docs')"
          @mouseenter="(e: MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = accentColor; el.style.color = accentColor }"
          @mouseleave="(e: MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = ''; el.style.color = '' }"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
            <path d="M14 3v5h5" />
            <path d="M9 13h6" />
            <path d="M9 17h4" />
          </svg>
        </NuxtLink>

        <NuxtLink
          to="/support"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          :aria-label="t('topBar.support')"
          :title="t('topBar.support')"
          @mouseenter="(e: MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = accentColor; el.style.color = accentColor }"
          @mouseleave="(e: MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = ''; el.style.color = '' }"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
        </NuxtLink>

        <ThemeToggle />

        <LanguageSwitcher />

        <NuxtLink
          to="/profile"
          class="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-white transition"
          :style="{ backgroundColor: accentColor }"
          :class="{ 'hover:opacity-90': true }"
          :aria-label="t('topBar.profile')"
          :title="t('topBar.profile')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3a5 5 0 0 1 3.187 8.871A8 8 0 0 1 20 19.25a.75.75 0 0 1-1.5 0 6.5 6.5 0 0 0-13 0 .75.75 0 0 1-1.5 0 8 8 0 0 1 4.814-7.379A5 5 0 0 1 12 3Zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
              fill="currentColor"
            />
          </svg>
          <span>{{ currentUser?.email ?? t('common.unknown') }}</span>
        </NuxtLink>
      </div>

      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="-translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="-translate-y-2 opacity-0"
      >
        <div v-if="mobileSearchOpen" id="mobile-search-panel" class="w-full md:hidden">
          <label class="sr-only" for="mobile-global-search">{{ t('topBar.searchLabel') }}</label>
          <div
            class="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
          >
            <input
              id="mobile-global-search"
              ref="mobileSearchInput"
              v-model="search"
              type="search"
              :placeholder="t('topBar.searchPlaceholder')"
              class="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
              @keyup.esc="closeMobileSearch"
            />
            <button
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:text-slate-800 dark:text-slate-300 dark:hover:text-white"
              :aria-label="t('topBar.toggleSearchClose')"
              @click="closeMobileSearch"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6.225 5.175a.75.75 0 0 0-1.05 1.05L10.94 12l-5.765 5.775a.75.75 0 1 0 1.05 1.05L12 13.06l5.775 5.765a.75.75 0 0 0 1.05-1.05L13.06 12l5.765-5.775a.75.75 0 0 0-1.05-1.05L12 10.94Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, useI18n } from '#imports'
import ThemeToggle from '~/components/layout/ThemeToggle.vue'
import LanguageSwitcher from '~/components/layout/LanguageSwitcher.vue'
import { useAuth } from '~/composables/useAuth'

const auth = useAuth()
const { t } = useI18n()
const search = ref('')
const currentUser = computed(() => auth.user.value)
const mobileSearchOpen = ref(false)
const mobileSearchInput = ref<HTMLInputElement | null>(null)

const accentColor = computed(() => {
  return auth.branding.value?.activeTheme.accentColor || '#1C6DD0'
})

const toggleMobileSearch = () => {
  mobileSearchOpen.value = !mobileSearchOpen.value
}

const closeMobileSearch = () => {
  mobileSearchOpen.value = false
}

watch(mobileSearchOpen, value => {
  if (value) {
    nextTick(() => {
      mobileSearchInput.value?.focus()
    })
  }
})

</script>

