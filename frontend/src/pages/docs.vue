<template>
  <div class="flex min-h-[calc(100vh-200px)] -mx-4 lg:-mx-10">
    <!-- Sidebar Navigation -->
    <aside
      class="sticky top-0 hidden h-screen w-64 flex-shrink-0 overflow-y-auto border-r border-slate-200 bg-white px-4 py-6 dark:border-white/10 dark:bg-slate-900 lg:block"
    >
      <nav class="space-y-1">
        <div class="mb-6">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Dokumentation
          </h2>
        </div>

        <NuxtLink
          v-for="item in navigation"
          :key="item.id"
          :to="`/docs${item.path}`"
          class="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition"
          :class="
            currentPath === `/docs${item.path}`
              ? 'bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          "
        >
          <component :is="item.icon" class="h-5 w-5 flex-shrink-0" />
          <span>{{ item.title }}</span>
        </NuxtLink>

        <div v-if="currentSection" class="mt-8 space-y-1">
          <p class="px-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {{ currentSection.title }}
          </p>
          <NuxtLink
            v-for="subItem in currentSection.items"
            :key="subItem.id"
            :to="`/docs${subItem.path}`"
            class="block rounded-lg px-3 py-2 text-sm transition"
            :class="
              currentPath === `/docs${subItem.path}`
                ? 'bg-brand/10 text-brand font-medium dark:bg-brand/20 dark:text-brand'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            "
          >
            {{ subItem.title }}
          </NuxtLink>
        </div>
      </nav>
    </aside>

    <!-- Mobile Sidebar Toggle -->
    <button
      class="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg transition hover:bg-brand/90 lg:hidden"
      @click="mobileSidebarOpen = !mobileSidebarOpen"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>

    <!-- Mobile Sidebar Overlay -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="mobileSidebarOpen"
        class="fixed inset-0 z-40 bg-black/50 lg:hidden"
        @click="mobileSidebarOpen = false"
      />
    </Transition>

    <!-- Mobile Sidebar -->
    <Transition
      enter-active-class="transition-transform duration-200"
      enter-from-class="-translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-200"
      leave-from-class="translate-x-0"
      leave-to-class="-translate-x-full"
    >
      <aside
        v-if="mobileSidebarOpen"
        class="fixed left-0 top-0 z-50 h-full w-64 overflow-y-auto border-r border-slate-200 bg-white px-4 py-6 dark:border-white/10 dark:bg-slate-900 lg:hidden"
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Dokumentation</h2>
          <button
            class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            @click="mobileSidebarOpen = false"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav class="space-y-1">
          <NuxtLink
            v-for="item in navigation"
            :key="item.id"
            :to="`/docs${item.path}`"
            class="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition"
            :class="
              currentPath === `/docs${item.path}`
                ? 'bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            "
            @click="mobileSidebarOpen = false"
          >
            <component :is="item.icon" class="h-5 w-5 flex-shrink-0" />
            <span>{{ item.title }}</span>
          </NuxtLink>

          <div v-if="currentSection" class="mt-8 space-y-1">
            <p class="px-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ currentSection.title }}
            </p>
            <NuxtLink
              v-for="subItem in currentSection.items"
              :key="subItem.id"
              :to="`/docs${subItem.path}`"
              class="block rounded-lg px-3 py-2 text-sm transition"
              :class="
                currentPath === `/docs${subItem.path}`
                  ? 'bg-brand/10 text-brand font-medium dark:bg-brand/20 dark:text-brand'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              "
              @click="mobileSidebarOpen = false"
            >
              {{ subItem.title }}
            </NuxtLink>
          </div>
        </nav>
      </aside>
    </Transition>

    <!-- Main Content -->
    <main class="flex-1 px-4 py-8 lg:px-12">
      <div class="mx-auto max-w-4xl">
        <div class="prose prose-slate max-w-none dark:prose-invert">
          <h1 class="mb-2 text-4xl font-bold text-slate-900 dark:text-white">
            {{ currentPage?.title || 'Dokumentation' }}
          </h1>
          <p v-if="currentPage?.description" class="mb-8 text-lg text-slate-600 dark:text-slate-400">
            {{ currentPage.description }}
          </p>

          <div class="mt-8">
            <div v-if="currentPath === '/docs'" class="grid gap-6 md:grid-cols-2">
              <NuxtLink
                v-for="item in navigation"
                :key="item.id"
                :to="`/docs${item.path}`"
                class="group rounded-xl border border-slate-200 bg-white p-6 transition hover:border-brand hover:shadow-lg dark:border-white/10 dark:bg-slate-800/50 dark:hover:border-brand"
              >
                <div class="mb-3 flex items-center gap-3">
                  <component
                    :is="item.icon"
                    class="h-6 w-6 text-brand transition group-hover:scale-110"
                  />
                  <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{{ item.title }}</h3>
                </div>
                <p class="text-sm text-slate-600 dark:text-slate-400">
                  {{ item.description }}
                </p>
              </NuxtLink>
            </div>
            <NuxtPage v-else />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from '#imports'

definePageMeta({
  layout: 'default'
})

const route = useRoute()
const mobileSidebarOpen = ref(false)

const currentPath = computed(() => route.path)

// Icons as components
const HomeIcon = {
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  `
}

const BookIcon = {
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  `
}

const ServerIcon = {
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  `
}

const CloudIcon = {
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  `
}

const CogIcon = {
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  `
}

const ShieldIcon = {
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  `
}

const navigation = [
  {
    id: 'getting-started',
    title: 'Kom igång',
    path: '/getting-started',
    icon: HomeIcon,
    description: 'Lär dig grunderna och kom igång med Cloud Portal.'
  },
  {
    id: 'dns',
    title: 'DNS',
    path: '/dns',
    icon: ServerIcon,
    description: 'Hantera DNS-zoner och poster via Cloudflare.'
  },
  {
    id: 'containers',
    title: 'Containers',
    path: '/containers',
    icon: CloudIcon,
    description: 'Deploya och hantera containers med Incus.'
  },
  {
    id: 'virtual-machines',
    title: 'Virtual Machines',
    path: '/virtual-machines',
    icon: ServerIcon,
    description: 'Skapa och hantera virtuella maskiner.'
  },
  {
    id: 'auth',
    title: 'Auth & SSO',
    path: '/auth',
    icon: ShieldIcon,
    description: 'Konfigurera Single Sign-On med olika Identity Providers.'
  },
  {
    id: 'settings',
    title: 'Inställningar',
    path: '/settings',
    icon: CogIcon,
    description: 'Konfigurera ditt konto och API-nycklar.'
  }
]

const sections = {
  'getting-started': {
    title: 'Kom igång',
    items: [
      { id: 'overview', title: 'Översikt', path: '/getting-started/overview' },
      { id: 'authentication', title: 'Autentisering', path: '/getting-started/authentication' },
      { id: 'organizations', title: 'Organisationer', path: '/getting-started/organizations' }
    ]
  },
  'dns': {
    title: 'DNS',
    items: [
      { id: 'overview', title: 'Översikt', path: '/dns/overview' },
      { id: 'zones', title: 'Zoner', path: '/dns/zones' },
      { id: 'records', title: 'DNS-poster', path: '/dns/records' }
    ]
  },
  'containers': {
    title: 'Containers',
    items: [
      { id: 'overview', title: 'Översikt', path: '/containers/overview' },
      { id: 'deployment', title: 'Deployment', path: '/containers/deployment' },
      { id: 'management', title: 'Hantering', path: '/containers/management' }
    ]
  },
  'virtual-machines': {
    title: 'Virtual Machines',
    items: [
      { id: 'overview', title: 'Översikt', path: '/virtual-machines/overview' },
      { id: 'creation', title: 'Skapa VM', path: '/virtual-machines/creation' },
      { id: 'networking', title: 'Nätverk', path: '/virtual-machines/networking' }
    ]
  },
  'auth': {
    title: 'Auth & SSO',
    items: [
      { id: 'openid', title: 'OpenID Connect', path: '/auth/openid' },
      { id: 'entra', title: 'Microsoft Entra ID', path: '/auth/entra' },
      { id: 'saml', title: 'SAML 2.0', path: '/auth/saml' }
    ]
  },
  'settings': {
    title: 'Inställningar',
    items: [
      { id: 'profile', title: 'Profil', path: '/settings/profile' },
      { id: 'security', title: 'Säkerhet', path: '/settings/security' },
      { id: 'api-keys', title: 'API-nycklar', path: '/settings/api-keys' }
    ]
  }
}

const currentSection = computed(() => {
  const pathParts = currentPath.value.split('/').filter(Boolean)
  if (pathParts.length > 1 && pathParts[0] === 'docs') {
    const sectionKey = pathParts[1]
    return sections[sectionKey as keyof typeof sections] || null
  }
  return null
})

const currentPage = computed(() => {
  if (currentPath.value === '/docs') {
    return {
      title: 'Dokumentation',
      description: 'Här hittar du all information om hur du använder Cloud Portal.'
    }
  }
  
  // Find matching navigation item
  const pathParts = currentPath.value.split('/').filter(Boolean)
  if (pathParts.length > 1 && pathParts[0] === 'docs') {
    const sectionKey = pathParts[1]
    const navItem = navigation.find(item => item.path === `/${sectionKey}`)
    if (navItem) {
      return {
        title: navItem.title,
        description: navItem.description
      }
    }
  }
  
  return {
    title: 'Dokumentation',
    description: 'Här hittar du all information om hur du använder Cloud Portal.'
  }
})
</script>

<style scoped>
.prose {
  @apply text-slate-700 dark:text-slate-300;
}

.prose h1 {
  @apply text-slate-900 dark:text-white;
}

.prose h2 {
  @apply text-slate-900 dark:text-white;
}

.prose h3 {
  @apply text-slate-900 dark:text-white;
}

.prose a {
  @apply text-brand hover:text-brand/80;
}

.prose code {
  @apply rounded bg-slate-100 px-1.5 py-0.5 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-200;
}

.prose pre {
  @apply rounded-lg bg-slate-900 text-slate-100;
}

.prose blockquote {
  @apply border-l-brand;
}
</style>

