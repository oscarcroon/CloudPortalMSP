<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <NuxtLink
        to="/admin"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        ← Tillbaka
      </NuxtLink>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Skapa organisation</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">Två steg: grundläggande organisationsinställningar och uppgifter för ägarkontot.</p>
    </header>

    <div class="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div class="flex items-center gap-4">
        <div v-for="step in steps" :key="step.id" class="flex items-center gap-2">
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold"
            :class="currentStep === step.id ? 'border-brand bg-brand text-white' : 'border-slate-300 text-slate-600 dark:border-white/20 dark:text-slate-300'"
          >
            {{ step.id }}
          </div>
          <p class="text-sm font-medium text-slate-700 dark:text-slate-200">
            {{ step.label }}
          </p>
          <div v-if="step.id !== steps.length" class="h-px w-8 bg-slate-200 dark:bg-white/10" />
        </div>
      </div>
    </div>

    <form class="space-y-6" @submit.prevent="handleSubmit">
      <div v-show="currentStep === 1" class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Steg 1: Organisationsdetaljer</h2>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div v-if="!hasPrefillTenant" class="md:col-span-2">
            <TenantSelector
              v-model="form.tenantId"
              :distributors="providers"
              :required="true"
              label="Leverantör"
              placeholder="Välj leverantör..."
              help-text="Välj leverantör som organisationen ska tillhöra"
            />
          </div>
          <div v-else class="md:col-span-2">
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Leverantör</label>
            <p class="mt-1 text-sm font-medium text-slate-900 dark:text-white">{{ prefillTenantName }}</p>
            <input type="hidden" :value="form.tenantId" />
          </div>
          <div class="md:col-span-2">
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Namn</label>
            <input
              v-model="form.name"
              type="text"
              required
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              placeholder="Ex. CoreIT AB"
            />
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Slug</label>
            <input
              v-model="form.slug"
              type="text"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              placeholder="coreit-ab"
            />
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Lämna tomt för automatisk generering.</p>
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Kontaktperson</label>
            <input
              v-model="form.billingEmail"
              type="email"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              placeholder="kontakt@example.com"
            />
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">COREID <span class="text-red-500">*</span></label>
            <input
              v-model="form.coreId"
              type="text"
              maxlength="4"
              required
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white uppercase"
              placeholder="ABCD"
              style="text-transform: uppercase;"
            />
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Kundens prefix (fyra bokstäver). Går att redigera efter att organisationen har skapats.</p>
          </div>
        </div>
      </div>

      <div v-show="currentStep === 2" class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Steg 2: Ägarkonto</h2>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Här anger du e-postadressen för organisationens ägare. Om användaren inte finns kommer ett nytt konto att skapas. Efter att organisationen har skapats kommer en inbjudningslänk att skickas via e-post där ägaren kan acceptera inbjudan.
        </p>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div class="md:col-span-2">
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">E-post</label>
            <div class="relative">
              <input
                v-model="form.ownerEmail"
                type="email"
                required
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                placeholder="owner@example.com"
              />
              <div v-if="checkingEmail" class="absolute right-3 top-1/2 -translate-y-1/2">
                <div class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand"></div>
              </div>
            </div>
            <div v-if="existingUserInfo && !userConfirmed" class="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/40 dark:bg-amber-500/10">
              <p class="text-xs font-medium text-amber-800 dark:text-amber-200">
                ⚠️ En användare med denna e-postadress finns redan i systemet.
              </p>
              <p v-if="existingUserInfo.fullName" class="mt-1 text-xs text-amber-700 dark:text-amber-300">
                Namn: {{ existingUserInfo.fullName }}
              </p>
            </div>
            <div v-else-if="existingUserInfo && userConfirmed" class="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-500/40 dark:bg-emerald-500/10">
              <p class="text-xs font-medium text-emerald-800 dark:text-emerald-200">
                ✓ Bekräftad: Användaren kommer att läggas till som ägare.
              </p>
            </div>
          </div>
          <div class="md:col-span-2">
            <p v-if="existingUserInfo && userConfirmed" class="text-xs text-slate-500 dark:text-slate-400">
              En inbjudningslänk kommer att skickas via e-post till den befintliga användaren.
            </p>
            <p v-else class="text-xs text-slate-500 dark:text-slate-400">
              Ett användarkonto kommer att skapas och en inbjudningslänk skickas via e-post. Användaren kan ange sitt namn när de accepterar inbjudan.
            </p>
          </div>
        </div>
      </div>

      <div v-if="errorMessage" class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
        {{ errorMessage }}
      </div>

      <!-- Confirmation dialog for existing user -->
      <div
        v-if="showConfirmDialog"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
        @click.self="showConfirmDialog = false"
      >
        <div class="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0f172a]">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Bekräfta e-postadress</h3>
          <p class="text-sm text-slate-600 dark:text-slate-400">
            En användare med e-postadressen <strong class="font-semibold text-slate-900 dark:text-white">{{ form.ownerEmail }}</strong> finns redan i systemet.
          </p>
          <div v-if="existingUserInfo" class="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Befintlig användare</p>
            <p class="mt-1 text-sm font-medium text-slate-900 dark:text-white">
              {{ existingUserInfo.fullName || 'Inget namn angivet' }}
            </p>
            <p class="mt-1 text-xs text-slate-600 dark:text-slate-400">{{ existingUserInfo.email }}</p>
          </div>
          <p class="text-sm text-slate-600 dark:text-slate-400">
            Denna användare kommer att läggas till som ägare i den nya organisationen. Är du säker på att detta är rätt e-postadress?
          </p>
          <div class="flex gap-3">
            <button
              type="button"
              class="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
              @click="showConfirmDialog = false"
            >
              Avbryt
            </button>
            <button
              type="button"
              class="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80"
              @click="confirmExistingUser"
            >
              Bekräfta och fortsätt
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <button
          type="button"
          class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
          @click="goToPreviousStep"
        >
          Föregående
        </button>

        <div class="flex gap-2">
          <button
            v-if="currentStep < 2"
            type="button"
            class="rounded-lg bg-brand/10 px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/20"
            :disabled="!canContinue"
            @click="goToNextStep"
          >
            Nästa steg
          </button>
          <button
            v-else
            type="submit"
            class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80 disabled:opacity-60"
            :disabled="submitting"
          >
            {{ submitting ? 'Skapar...' : 'Skapa organisation' }}
          </button>
        </div>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, useFetch, useRoute, useRouter, watch } from '#imports'
import type { AdminCreateOrganizationResponse, AdminTenantSummary } from '~/types/admin'
import TenantSelector from '~/components/admin/TenantSelector.vue'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'default'
  // superAdmin not required - API endpoint validates tenant permissions
})

const router = useRouter()
const route = useRoute()
const auth = useAuth()

// Check if user has tenant access or is super admin
if (import.meta.client) {
  await auth.bootstrap()
  const hasTenantAccess = auth.isSuperAdmin.value || Object.keys(auth.state.value.data?.tenantRoles ?? {}).length > 0
  if (!hasTenantAccess) {
    await router.replace('/settings?error=missing-permission')
  }
}
const steps = [
  { id: 1, label: 'Organisationsdetaljer' },
  { id: 2, label: 'Ägarkonto' }
]

const currentStep = ref(1)
const submitting = ref(false)
const errorMessage = ref('')
const showConfirmDialog = ref(false)
const existingUserInfo = ref<{ email: string; fullName: string | null; status: string } | null>(null)
const userConfirmed = ref(false)
const checkingEmail = ref(false)

// Get tenantId from query if provided, or use currentTenant
const queryTenantId = typeof route.query.tenantId === 'string' ? route.query.tenantId : ''
const initialTenantId = queryTenantId || auth.currentTenant.value?.id || ''
const hasPrefillTenant = Boolean(queryTenantId)

// Fetch providers (organizations are now linked to providers, not distributors)
interface TenantsResponse {
  tenants: AdminTenantSummary[]
  organizations?: any[]
  distributorProviderLinks?: any[]
}

const { data: providersData } = await useFetch<TenantsResponse>('/api/admin/tenants', {
  query: { type: 'provider' }
})

const providers = computed(() => providersData.value?.tenants ?? [])

// Get prefill tenant name
const prefillTenantName = computed(() => {
  if (!hasPrefillTenant || !initialTenantId) return ''
  const tenant = providers.value.find((p: AdminTenantSummary) => p.id === initialTenantId)
  return tenant?.name ?? auth.currentTenant.value?.name ?? initialTenantId
})

const form = reactive({
  tenantId: initialTenantId,
  name: '',
  slug: '',
  billingEmail: '',
  coreId: '',
  ownerEmail: ''
})

const canContinue = computed(() => {
  if (currentStep.value === 1) {
    return Boolean(form.tenantId && form.name.trim() && form.coreId.trim().length === 4)
  }
  if (currentStep.value === 2) {
    return Boolean(form.ownerEmail.trim() && (userConfirmed.value || !existingUserInfo.value))
  }
  return true
})

// Check if user exists when email is entered
watch(
  () => form.ownerEmail,
  async (newEmail, oldEmail) => {
    // Reset confirmation if email changed
    if (newEmail !== oldEmail) {
      userConfirmed.value = false
    }

    if (!newEmail || newEmail.trim().length === 0) {
      existingUserInfo.value = null
      userConfirmed.value = false
      showConfirmDialog.value = false
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      existingUserInfo.value = null
      userConfirmed.value = false
      showConfirmDialog.value = false
      return
    }

    checkingEmail.value = true
    try {
      const result = await $fetch<{ exists: boolean; user?: { email: string; fullName: string | null; status: string } }>(
        '/api/admin/users/check-email',
        {
          method: 'POST',
          body: { email: newEmail }
        }
      )

      if (result.exists && result.user) {
        existingUserInfo.value = result.user
        // Only show dialog if not already confirmed and we're on step 2
        if (currentStep.value === 2 && !userConfirmed.value) {
          showConfirmDialog.value = true
        }
      } else {
        existingUserInfo.value = null
        userConfirmed.value = false
        showConfirmDialog.value = false
      }
    } catch (error) {
      console.error('Failed to check email', error)
      existingUserInfo.value = null
      userConfirmed.value = false
      showConfirmDialog.value = false
    } finally {
      checkingEmail.value = false
    }
  },
  { debounce: 500 }
)

// Show confirmation dialog when entering step 2 if user exists
watch(
  () => currentStep.value,
  async (newStep) => {
    if (newStep === 2 && existingUserInfo.value && !userConfirmed.value) {
      showConfirmDialog.value = true
    }
  }
)

const confirmExistingUser = () => {
  userConfirmed.value = true
  showConfirmDialog.value = false
}

const goToPreviousStep = () => {
  if (currentStep.value <= 1) {
    // Navigate back to tenant page if tenantId is provided, otherwise to admin dashboard
    const tenantId = typeof route.query.tenantId === 'string' ? route.query.tenantId : null
    if (tenantId) {
      router.push(`/tenant-admin/tenants/${tenantId}`)
    } else {
      router.push('/admin')
    }
    return
  }
  currentStep.value = Math.max(1, currentStep.value - 1)
  showConfirmDialog.value = false
}

const goToNextStep = () => {
  if (currentStep.value >= steps.length || !canContinue.value) return
  currentStep.value = Math.min(steps.length, currentStep.value + 1)
}

const handleSubmit = async () => {
  if (!canContinue.value) {
    return
  }

  submitting.value = true
  errorMessage.value = ''

  try {
    const payload = {
      name: form.name.trim(),
      tenantId: form.tenantId,
      owner: {
        email: form.ownerEmail.trim()
      } as { email: string; fullName?: string }
    }

    if (form.slug.trim()) {
      payload.slug = form.slug.trim()
    }
    if (form.billingEmail.trim()) {
      payload.billingEmail = form.billingEmail.trim()
    }
    payload.coreId = form.coreId.trim().toUpperCase()

    const response = await $fetch<AdminCreateOrganizationResponse>('/api/admin/organizations', {
      method: 'POST',
      body: payload
    })

    await router.push({
      path: `/tenant-admin/organizations/${response.organization.slug}/overview`,
      query: { created: '1' }
    })
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Kunde inte skapa organisationen just nu.'
  } finally {
    submitting.value = false
  }
}
</script>

