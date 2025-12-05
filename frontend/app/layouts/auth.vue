<template>
  <div
    class="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-50"
    :style="containerStyle"
  >
    <div class="absolute right-6 top-6">
      <ThemeToggle />
    </div>
    <NuxtLink
      to="/"
      class="mb-10 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-200"
    >
      <img :src="currentLogo" alt="Cloud Portal" class="h-16 w-auto drop-shadow-md" />
      Cloud Portal
    </NuxtLink>
    <main
      class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-white/10 dark:bg-white/5"
    >
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useColorMode } from '#imports'
import logoLight from '~/assets/images/coreit-logo.svg'
import logoDark from '~/assets/images/coreit-logo-neg.svg'
import ThemeToggle from '~/components/layout/ThemeToggle.vue'
import { useLoginBranding } from '~/composables/useLoginBranding'

const colorMode = useColorMode()
const loginBranding = useLoginBranding()

const fallbackLogo = computed(() => (colorMode.value === 'dark' ? logoDark : logoLight))
const currentLogo = computed(
  () => loginBranding.loginLogo.value ?? fallbackLogo.value
)

const accentVariables = computed(() => {
  const accentHex = loginBranding.accentColor.value
  if (!accentHex) {
    return {}
  }
  const rgb = hexToRgb(accentHex)
  const darkMix = mixRgb(rgb, [0, 0, 0], 0.35)
  const lightMix = mixRgb(rgb, [255, 255, 255], 0.82)
  return {
    '--brand-hex': accentHex,
    '--brand': rgb.join(' '),
    '--brand-dark': darkMix.join(' '),
    '--brand-light': lightMix.join(' ')
  }
})

const backgroundStyle = computed(() => {
  const bg = loginBranding.background.value
  if (!bg?.url) {
    return {
      backgroundColor: bg?.fallbackColor ?? bg?.color ?? '#0f172a'
    }
  }
  const tint = bg.color
  const primaryOpacity = bg.opacity ?? 0.85
  const secondaryOpacity = bg.secondaryOpacity ?? Math.max(primaryOpacity * 0.75, 0)
  return {
    backgroundColor: tint,
    backgroundImage: `linear-gradient(135deg, ${applyAlpha(tint, primaryOpacity)}, ${applyAlpha(
      tint,
      secondaryOpacity
    )}), url(${bg.url})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  }
})

const containerStyle = computed(() => ({
  ...backgroundStyle.value,
  ...accentVariables.value
}))

function applyAlpha(hexColor: string, alpha: number) {
  const hex = hexColor.replace('#', '')
  const bigint = parseInt(hex, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function hexToRgb(hexColor: string) {
  const hex = hexColor.replace('#', '')
  const bigint = parseInt(hex, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return [r, g, b]
}

function mixRgb(base: number[], target: number[], amount: number) {
  return base.map((channel, index) =>
    Math.round(channel + (target[index] - channel) * amount)
  )
}
</script>

