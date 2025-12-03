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
          <div v-if="tenantType === 'provider'" class="md:col-span-2 space-y-3">
            <div
              v-if="checkingOwnerEmail"
              class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300"
            >
              Kontrollerar om e-postadressen finns i systemet...
            </div>
            <div
              v-else-if="ownerEmailStatus === 'exists'"
              class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100"
            >
              Kontot finns redan i systemet
              <span v-if="existingUserInfo?.fullName" class="font-semibold">({{ existingUserInfo.fullName }})</span
              >. Personen får direkt åtkomst till leverantören utan att du behöver skapa en ny organisation.
            </div>
            <div
              v-else-if="ownerEmailStatus === 'invalid'"
              class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
            >
              Ange en giltig e-postadress för att fortsätta.
            </div>
            <div
              v-else-if="ownerEmailStatus === 'new'"
              class="rounded-lg border border-dashed border-slate-200 px-4 py-3 dark:border-white/10"
            >
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-slate-900 dark:text-white">Skapa organisation samtidigt</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    Rekommenderas om leverantören behöver en första kundorganisation direkt.
                  </p>
                </div>
                <button
                  type="button"
                  class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-slate-900"
                  :class="organizationForm.enabled ? 'bg-brand' : 'bg-slate-300 dark:bg-slate-600'"
                  @click="organizationForm.enabled = !organizationForm.enabled"
                >
                  <span
                    class="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
                    :class="organizationForm.enabled ? 'translate-x-6' : 'translate-x-1'"
                  />
                </button>
              </div>
            </div>
          </div>
          <div v-if="tenantType === 'provider' && organizationForm.enabled" class="md:col-span-2">
            <div class="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/5">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-900 dark:text-white">Organisationsdetaljer</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    Denna organisation skapas automatiskt när ägaren accepterar inbjudan.
                  </p>
                </div>
              </div>
              <div class="mt-4 grid gap-4 md:grid-cols-2">
                <div class="md:col-span-2">
                  <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Namn</label>
                  <input
                    v-model="organizationForm.name"
                    type="text"
                    required
                    class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                    placeholder="Ex. CoreIT AB"
                  />
                </div>
                <div>
                  <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Slug (valfritt)</label>
                  <input
                    v-model="organizationForm.slug"
                    type="text"
                    class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                    placeholder="coreit-ab"
                  />
                </div>
                <div>
                  <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400"
                    >Fakturae-post (valfritt)</label
                  >
                  <input
                    v-model="organizationForm.billingEmail"
                    type="email"
                    class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                    placeholder="billing@example.com"
                  />
                </div>
                <div>
                  <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">CORE ID (valfritt)</label>
                  <input
                    v-model="organizationForm.coreId"
                    type="text"
                    maxlength="4"
                    class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                    placeholder="ABCD"
                  />
                  <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">4 tecken. Lämna tomt om okänt.</p>
                </div>
              </div>
            </div>
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
import { computed, reactive, ref, useFetch, useRoute, useRouter, watch } from '#imports'
import type { AdminCreateTenantResponse, AdminTenantSummary } from '~/types/admin'

definePageMeta({
  layout: 'default'
})

const router = useRouter()
const route = useRoute()
const tenantType = computed(() => {
  const type = typeof route.query.type === 'string' ? route.query.type : 'provider'
  return type === 'distributor' ? 'distributor' : 'provider'
})

const submitting = ref(false)
const errorMessage = ref('')
const checkingOwnerEmail = ref(false)
const ownerEmailStatus = ref<'idle' | 'invalid' | 'exists' | 'new'>('idle')
const existingUserInfo = ref<{ email: string; fullName: string | null; status: string } | null>(null)

const canCreateOrganization = computed(() => ownerEmailStatus.value === 'new')
const organizationForm = reactive({
  enabled: false,
  name: '',
  slug: '',
  billingEmail: '',
  coreId: ''
})

const resetOrganizationForm = () => {
  organizationForm.enabled = false
  organizationForm.name = ''
  organizationForm.slug = ''
  organizationForm.billingEmail = ''
  organizationForm.coreId = ''
}

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
  ownerEmail: ''
})

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

watch(
  () => canCreateOrganization.value,
  (allowed) => {
    if (!allowed) {
      resetOrganizationForm()
    }
  }
)

watch(
  () => form.ownerEmail,
  async (newEmail, oldEmail) => {
    if (newEmail === oldEmail || tenantType.value !== 'provider') return
    
    const trimmed = newEmail?.trim() ?? ''
    
    // Reset state when email is empty
    if (!trimmed) {
      existingUserInfo.value = null
      ownerEmailStatus.value = 'idle'
      resetOrganizationForm()
      return
    }

    // Only validate format if email has some content
    const normalizedEmail = trimmed.toLowerCase()
    if (!emailRegex.test(normalizedEmail)) {
      // Only show invalid if email looks like it's being typed (has @ but incomplete)
      // or if it's clearly invalid after user has typed more
      if (trimmed.length > 3 && !trimmed.includes('@')) {
        ownerEmailStatus.value = 'invalid'
      } else if (trimmed.includes('@') && !emailRegex.test(normalizedEmail)) {
        ownerEmailStatus.value = 'invalid'
      } else {
        // Still typing, don't show invalid yet
        ownerEmailStatus.value = 'idle'
      }
      existingUserInfo.value = null
      resetOrganizationForm()
      return
    }

    // Valid email format - check if user exists
    existingUserInfo.value = null
    ownerEmailStatus.value = 'idle'
    resetOrganizationForm()
    checkingOwnerEmail.value = true
    
    try {
      const result = await $fetch<{ exists: boolean; user?: { email: string; fullName: string | null; status: string } }>(
        '/api/admin/users/check-email',
        {
          method: 'POST',
          body: { email: normalizedEmail }
        }
      )
      if (result.exists) {
        ownerEmailStatus.value = 'exists'
        existingUserInfo.value = result.user ?? null
      } else {
        ownerEmailStatus.value = 'new'
      }
    } catch (error) {
      console.error('[tenant-create] Failed to check owner email', error)
      // On error, don't set invalid - just reset to idle
      ownerEmailStatus.value = 'idle'
      existingUserInfo.value = null
      resetOrganizationForm()
    } finally {
      checkingOwnerEmail.value = false
    }
  },
  { debounce: 500 }
)

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
    if (tenantType.value === 'provider' && form.distributorIds.length > 0) {
      payload.distributorIds = form.distributorIds
    }

    if (tenantType.value === 'provider' && organizationForm.enabled && canCreateOrganization.value) {
      if (!organizationForm.name.trim()) {
        errorMessage.value = 'Ange ett organisationsnamn om du vill skapa organisationen direkt.'
        submitting.value = false
        return
      }
      if (organizationForm.billingEmail.trim() && !emailRegex.test(organizationForm.billingEmail.trim())) {
        errorMessage.value = 'Billing-e-postadressen för organisationen är ogiltig.'
        submitting.value = false
        return
      }
      if (organizationForm.coreId.trim() && organizationForm.coreId.trim().length !== 4) {
        errorMessage.value = 'COREID måste bestå av exakt 4 tecken.'
        submitting.value = false
        return
      }

      payload.organization = {
        name: organizationForm.name.trim(),
        ...(organizationForm.slug.trim() ? { slug: organizationForm.slug.trim() } : {}),
        ...(organizationForm.billingEmail.trim() ? { billingEmail: organizationForm.billingEmail.trim() } : {}),
        ...(organizationForm.coreId.trim()
          ? { coreId: organizationForm.coreId.trim().toUpperCase() }
          : {})
      }
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

