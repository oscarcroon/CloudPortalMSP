<template>
  <div class="relative" ref="container">
    <button
      type="button"
      class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
      :aria-label="t('language.switcher.label')"
      :title="t('language.switcher.label')"
      @click="toggle"
      @mouseenter="(e: MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = accentColor }"
      @mouseleave="(e: MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '' }"
    >
      <svg
        v-if="currentLocale === 'sv'"
        viewBox="0 0 16 10"
        class="h-4 w-5 rounded-sm"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="16" height="10" fill="#006AA7" />
        <rect x="0" y="4" width="16" height="2" fill="#FECC00" />
        <rect x="6" y="0" width="2" height="10" fill="#FECC00" />
      </svg>
      <svg
        v-else-if="currentLocale === 'en'"
        viewBox="0 0 16 10"
        class="h-4 w-5 rounded-sm"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="16" height="10" fill="#012169" />
        <path d="M0 0 L16 10 M16 0 L0 10" stroke="#FFF" stroke-width="2" />
        <path d="M0 0 L16 10 M16 0 L0 10" stroke="#C8102E" stroke-width="1.2" />
        <rect x="0" y="4" width="16" height="2" fill="#FFF" />
        <rect x="6" y="0" width="2" height="10" fill="#FFF" />
        <rect x="0" y="4" width="16" height="1.2" fill="#C8102E" />
        <rect x="6.4" y="0" width="1.2" height="10" fill="#C8102E" />
      </svg>
    </button>

    <Transition
      v-if="!isToggleMode"
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 -translate-y-1"
    >
      <div
        v-if="open && !isToggleMode"
        class="absolute right-0 top-full z-[60] mt-2 min-w-[160px] rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800"
        @click.stop
      >
        <div class="p-1">
          <button
            v-for="localeOption in supportedLocales"
            :key="localeOption.code"
            type="button"
            class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700"
            :class="{
              'bg-slate-100 dark:bg-slate-700': currentLocale === localeOption.code
            }"
            @click="selectLocale(localeOption.code)"
          >
            <svg
              v-if="localeOption.code === 'sv'"
              viewBox="0 0 16 10"
              class="h-4 w-5 rounded-sm"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="16" height="10" fill="#006AA7" />
              <rect x="0" y="4" width="16" height="2" fill="#FECC00" />
              <rect x="6" y="0" width="2" height="10" fill="#FECC00" />
            </svg>
            <svg
              v-else-if="localeOption.code === 'en'"
              viewBox="0 0 16 10"
              class="h-4 w-5 rounded-sm"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="16" height="10" fill="#012169" />
              <path d="M0 0 L16 10 M16 0 L0 10" stroke="#FFF" stroke-width="2" />
              <path d="M0 0 L16 10 M16 0 L0 10" stroke="#C8102E" stroke-width="1.2" />
              <rect x="0" y="4" width="16" height="2" fill="#FFF" />
              <rect x="6" y="0" width="2" height="10" fill="#FFF" />
              <rect x="0" y="4" width="16" height="1.2" fill="#C8102E" />
              <rect x="6.4" y="0" width="1.2" height="10" fill="#C8102E" />
            </svg>
            <span class="flex-1 text-left">{{ localeOption.name }}</span>
            <svg
              v-if="currentLocale === localeOption.code"
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              :style="{ color: accentColor }"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from '#imports'
import { useI18n } from '#imports'
import { SUPPORTED_LOCALES, type SupportedLocaleCode } from '~/constants/i18n'
import { useAuth } from '~/composables/useAuth'

const { locale: currentLocale, setLocale, t } = useI18n()
const auth = useAuth()

const open = ref(false)
const container = ref<HTMLElement>()
const supportedLocales = SUPPORTED_LOCALES
const isChanging = ref(false)

const accentColor = computed(() => {
  return auth.branding.value?.activeTheme.accentColor || '#1C6DD0'
})

// Check if we should use toggle mode (exactly 2 languages)
const isToggleMode = computed(() => supportedLocales.length === 2)

// Get the other locale when in toggle mode
const otherLocale = computed(() => {
  if (!isToggleMode.value) return null
  return supportedLocales.find(locale => locale.code !== currentLocale.value)?.code ?? null
})

const toggle = () => {
  if (isToggleMode.value) {
    // Toggle mode: directly switch to the other language
    if (otherLocale.value) {
      void selectLocale(otherLocale.value)
    }
  } else {
    // Dropdown mode: open/close the dropdown
    open.value = !open.value
  }
}

const selectLocale = async (newLocale: SupportedLocaleCode) => {
  if (newLocale === currentLocale.value || isChanging.value) {
    open.value = false
    return
  }

  isChanging.value = true
  open.value = false
  const previousLocale = currentLocale.value as SupportedLocaleCode

  try {
    // Optimistically update locale
    await setLocale(newLocale)

    // Update in database if user is logged in
    if (auth.user.value) {
      try {
        await $fetch('/api/profile/locale', {
          method: 'PATCH',
          body: { locale: newLocale }
        })
        // Update auth state
        if (auth.user.value) {
          auth.user.value.locale = newLocale
        }
      } catch (error) {
        console.error('Failed to save locale preference:', error)
        // Rollback on error
        await setLocale(previousLocale)
      }
    }
  } catch (error) {
    console.error('Failed to change locale:', error)
    // Rollback on error
    await setLocale(previousLocale)
  } finally {
    isChanging.value = false
  }
}

const handleClickOutside = (event: MouseEvent) => {
  if (isToggleMode.value) return // No need for click outside in toggle mode
  if (container.value && !container.value.contains(event.target as Node)) {
    open.value = false
  }
}

onMounted(() => {
  if (!isToggleMode.value) {
    document.addEventListener('click', handleClickOutside)
  }
})

onBeforeUnmount(() => {
  if (!isToggleMode.value) {
    document.removeEventListener('click', handleClickOutside)
  }
})
</script>

