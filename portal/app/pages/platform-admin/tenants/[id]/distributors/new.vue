<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Skapa distributör</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        Skapa en ny distributör under leverantören "{{ providerName }}".
      </p>
    </header>

    <form class="space-y-6" @submit.prevent="handleSubmit">
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Distributör-detaljer</h2>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div class="md:col-span-2">
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Namn</label>
            <input
              v-model="form.name"
              type="text"
              required
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              placeholder="Ex. Regional Distributor AB"
            />
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Slug</label>
            <input
              v-model="form.slug"
              type="text"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              placeholder="regional-distributor"
            />
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Lämna tomt för automatisk generering.</p>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Ägarkonto</h2>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Skapa ett användarkonto för distributör-ägaren. En inbjudningslänk kommer att skickas via e-post.
        </p>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div class="md:col-span-2">
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">E-post</label>
            <input
              v-model="form.ownerEmail"
              type="email"
              required
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              placeholder="owner@example.com"
            />
          </div>
          <div class="md:col-span-2">
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Namn</label>
            <input
              v-model="form.ownerFullName"
              type="text"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              placeholder="Ex. Anna Andersson"
            />
          </div>
        </div>
      </div>

      <div v-if="errorMessage" class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
        {{ errorMessage }}
      </div>

      <div class="flex items-center justify-end gap-2">
        <NuxtLink
          :to="`/platform-admin/tenants/${providerId}`"
          class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
        >
          Avbryt
        </NuxtLink>
        <button
          type="submit"
          class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
          :disabled="submitting"
        >
          {{ submitting ? 'Skapar...' : 'Skapa distributör' }}
        </button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, useFetch, useRoute, useRouter } from '#imports'
import type { AdminTenantDetail } from '~/types/admin'

definePageMeta({
  layout: 'default'
})

const router = useRouter()
const route = useRoute()
const providerId = route.params.id as string

const { data, pending } = await (useFetch as any)(`/api/admin/tenants/${providerId}`)

const providerName = computed(() => data.value?.tenant.name ?? 'Leverantör')

const submitting = ref(false)
const errorMessage = ref('')

const form = reactive({
  name: '',
  slug: '',
  ownerEmail: '',
  ownerFullName: ''
})

const handleSubmit = async () => {
  submitting.value = true
  errorMessage.value = ''

  try {
    const payload: any = {
      name: form.name.trim(),
      owner: {
        email: form.ownerEmail.trim()
      }
    }

    if (form.slug.trim()) {
      payload.slug = form.slug.trim()
    }
    if (form.ownerFullName.trim()) {
      payload.owner.fullName = form.ownerFullName.trim()
    }

    const response = await ($fetch as any)(`/api/admin/tenants/${providerId}/distributors`, {
      method: 'POST',
      body: payload
    })

    await router.push({
      path: `/admin/tenants/${providerId}`,
      query: { created: '1' }
    })
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Kunde inte skapa distributör just nu.'
  } finally {
    submitting.value = false
  }
}
</script>

