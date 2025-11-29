<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">
        {{ tenantType === 'distributor' ? 'Skapa distributör' : 'Skapa leverantör' }}
      </h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        <span v-if="tenantType === 'distributor'">Distributörer är högsta nivån och kan kopplas till leverantörer.</span>
        <span v-else>Leverantörer kan skapa organisationer och kopplas till distributörer.</span>
      </p>
    </header>

    <form class="space-y-6" @submit.prevent="handleSubmit">
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Tenant-detaljer</h2>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div class="md:col-span-2">
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Namn</label>
            <input
              v-model="form.name"
              type="text"
              required
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              placeholder="Ex. Acme Suppliers AB"
            />
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Slug</label>
            <input
              v-model="form.slug"
              type="text"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              placeholder="acme-suppliers"
            />
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Lämna tomt för automatisk generering.</p>
          </div>
          <div v-if="tenantType === 'provider'">
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Distributörer</label>
            <div v-if="distributorsPending" class="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Laddar distributörer...
            </div>
            <div v-else class="mt-2 space-y-2">
              <label
                v-for="distributor in distributors"
                :key="distributor.id"
                class="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  :value="distributor.id"
                  v-model="form.distributorIds"
                  class="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand dark:border-white/10 dark:bg-black/20"
                />
                <span class="text-sm text-slate-900 dark:text-white">
                  {{ distributor.name }} ({{ distributor.slug }})
                </span>
              </label>
              <p v-if="distributors.length === 0" class="text-xs text-slate-500 dark:text-slate-400">
                Inga distributörer tillgängliga. Skapa en distributör först.
              </p>
            </div>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Välj vilka distributörer denna leverantör ska kopplas till.
            </p>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Ägarkonto</h2>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Skapa ett användarkonto för tenant-ägaren. En inbjudningslänk kommer att skickas via e-post.
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
          to="/admin/tenants"
          class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
        >
          Avbryt
        </NuxtLink>
        <button
          type="submit"
          class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80 disabled:opacity-60"
          :disabled="submitting"
        >
          {{ submitting ? 'Skapar...' : 'Skapa tenant' }}
        </button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, useFetch, useRoute, useRouter } from '#imports'
import type { AdminCreateTenantResponse, AdminTenantSummary } from '~/types/admin'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const router = useRouter()
const route = useRoute()
const tenantType = computed(() => {
  const type = typeof route.query.type === 'string' ? route.query.type : 'provider'
  return type === 'distributor' ? 'distributor' : 'provider'
})

const submitting = ref(false)
const errorMessage = ref('')

// Fetch distributors if creating provider
interface TenantsResponse {
  tenants: AdminTenantSummary[]
  organizations?: any[]
  distributorProviderLinks?: any[]
}

const { data: distributorsData, pending: distributorsPending } = await useFetch<TenantsResponse>('/api/admin/tenants', {
  query: { type: 'distributor' }
})

const distributors = computed(() => distributorsData.value?.tenants ?? [])

const form = reactive({
  name: '',
  slug: '',
  distributorIds: [] as string[], // For providers: which distributors to link to
  ownerEmail: '',
  ownerFullName: ''
})

const handleSubmit = async () => {
  submitting.value = true
  errorMessage.value = ''

  try {
    const payload: any = {
      name: form.name.trim(),
      type: tenantType.value,
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
    if (tenantType.value === 'provider' && form.distributorIds.length > 0) {
      payload.distributorIds = form.distributorIds
    }

    const response = await $fetch<AdminCreateTenantResponse>('/api/admin/tenants', {
      method: 'POST',
      body: payload
    })

    await router.push({
      path: `/admin/tenants/${response.tenant.id}`,
      query: { created: '1' }
    })
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Kunde inte skapa tenant just nu.'
  } finally {
    submitting.value = false
  }
}
</script>

