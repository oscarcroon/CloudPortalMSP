<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Organisationer</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        Skapa nya kundkonton och se en översikt över alla befintliga organisationer i plattformen.
      </p>
    </header>

    <div class="grid gap-8 lg:grid-cols-[360px,1fr]">
      <form
        class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
        @submit.prevent="handleSubmit"
      >
        <div class="space-y-6">
          <div class="space-y-4">
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Organisationsnamn</label>
              <input
                v-model="form.name"
                type="text"
                required
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                placeholder="Ex. CoreIT AB"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Slug</label>
              <input
                v-model="form.slug"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                placeholder="coreit-ab"
              />
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Lämna tomt för att generera baserat på namnet.
              </p>
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Faktura-e-post</label>
              <input
                v-model="form.billingEmail"
                type="email"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                placeholder="billing@example.com"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Standardroll</label>
              <select
                v-model="form.defaultRole"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              >
                <option v-for="role in roles" :key="role" :value="role">
                  {{ role }}
                </option>
              </select>
            </div>
            <div class="flex flex-col gap-3">
              <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input v-model="form.enforceSso" type="checkbox" class="rounded border-slate-300 dark:border-slate-600" />
                Kräv SSO för organisationen
              </label>
              <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  v-model="form.selfSignupEnabled"
                  type="checkbox"
                  class="rounded border-slate-300 dark:border-slate-600"
                />
                Tillåt självregistrering av användare
              </label>
            </div>
          </div>

          <div class="space-y-4 border-t border-slate-200 pt-4 dark:border-white/10">
            <p class="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Ägarkonto</p>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">E-post</label>
              <input
                v-model="form.ownerEmail"
                type="email"
                required
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                placeholder="owner@example.com"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Namn</label>
              <input
                v-model="form.ownerFullName"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                placeholder="Ex. Anna Andersson"
              />
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Används endast om kontot saknar namn idag.</p>
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Lösenord</label>
              <input
                v-model="form.ownerPassword"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                placeholder="Lämna tomt för auto-genererat lösenord"
              />
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Om e-postadressen saknar konto skapas ett nytt. Annars behöver lösenord inte anges.
              </p>
            </div>
          </div>

          <div v-if="formError" class="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">
            {{ formError }}
          </div>

          <div
            v-if="resultInfo"
            class="space-y-2 rounded-lg bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100"
          >
            <p>
              Organisationen <strong>{{ resultInfo.organizationName }}</strong> är skapad.
            </p>
            <p v-if="resultInfo.generatedPassword">
              Genererat lösenord för {{ resultInfo.ownerEmail }}:
              <code class="rounded bg-black/30 px-2 py-1 font-mono text-xs">
                {{ resultInfo.generatedPassword }}
              </code>
            </p>
            <p v-else>
              Kontot {{ resultInfo.ownerEmail }} har fått ägaråtkomst.
            </p>
          </div>

          <button
            type="submit"
            class="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80 disabled:opacity-50"
            :disabled="formLoading"
          >
            {{ formLoading ? 'Skapar...' : 'Skapa organisation' }}
          </button>
        </div>
      </form>

      <div class="rounded-xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-[#0c1524]">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Alla organisationer</h2>
          <button
            class="rounded border border-slate-300 px-3 py-1 text-xs uppercase tracking-wide text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
            @click="refresh()"
          >
            Uppdatera
          </button>
        </div>

        <div v-if="listError" class="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">
          {{ listError }}
        </div>
        <div v-else-if="pending" class="text-sm text-slate-600 dark:text-slate-400">Hämtar organisationer...</div>
        <div v-else-if="!organizations.length" class="text-sm text-slate-600 dark:text-slate-400">
          Det finns ännu inga organisationer.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full text-left text-sm text-slate-700 dark:text-slate-200">
            <thead>
              <tr class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10 dark:text-slate-400">
                <th class="px-3 py-2">Namn</th>
                <th class="px-3 py-2">Slug</th>
                <th class="px-3 py-2">Medlemmar</th>
                <th class="px-3 py-2">SSO</th>
                <th class="px-3 py-2">Självregistrering</th>
                <th class="px-3 py-2">Skapad</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="org in organizations"
                :key="org.id"
                class="border-b border-slate-100 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
              >
                <td class="px-3 py-2 font-medium text-slate-900 dark:text-white">{{ org.name }}</td>
                <td class="px-3 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">{{ org.slug }}</td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{{ org.memberCount }}</td>
                <td class="px-3 py-2">
                  <StatusPill :variant="org.enforceSso ? 'success' : 'info'">
                    {{ org.enforceSso ? 'På' : 'Av' }}
                  </StatusPill>
                </td>
                <td class="px-3 py-2">
                  <StatusPill :variant="org.selfSignupEnabled ? 'success' : 'info'">
                    {{ org.selfSignupEnabled ? 'På' : 'Av' }}
                  </StatusPill>
                </td>
                <td class="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                  {{ formatDate(org.createdAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, useAsyncData } from '#imports'
import StatusPill from '~/components/shared/StatusPill.vue'
import { rbacRoles } from '~/constants/rbac'
import type {
  AdminCreateOrganizationPayload,
  AdminCreateOrganizationResponse,
  AdminOrganizationSummary
} from '~/types/admin'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

type RbacRole = (typeof rbacRoles)[number]

const roles = rbacRoles

const { data, pending, refresh, error } = await useAsyncData(
  'admin-organizations',
  () => $fetch<{ organizations: AdminOrganizationSummary[] }>('/api/admin/organizations')
)

const organizations = computed(() => data.value?.organizations ?? [])
const listError = computed(() => (error.value ? error.value.message : ''))

const form = reactive({
  name: '',
  slug: '',
  billingEmail: '',
  defaultRole: 'viewer' as RbacRole,
  enforceSso: false,
  selfSignupEnabled: false,
  ownerEmail: '',
  ownerFullName: '',
  ownerPassword: ''
})

const formLoading = ref(false)
const formError = ref('')
const resultInfo = ref<{ organizationName: string; ownerEmail: string; generatedPassword: string | null } | null>(null)

const formatDate = (value: number) =>
  new Date(value).toLocaleString('sv-SE', {
    dateStyle: 'short',
    timeStyle: 'short'
  })

const handleSubmit = async () => {
  formError.value = ''
  resultInfo.value = null
  formLoading.value = true

  const trimmedSlug = form.slug.trim()
  const trimmedBilling = form.billingEmail.trim()
  const trimmedFullName = form.ownerFullName.trim()
  const trimmedPassword = form.ownerPassword.trim()

  const payload: AdminCreateOrganizationPayload = {
    name: form.name.trim(),
    defaultRole: form.defaultRole,
    enforceSso: form.enforceSso,
    selfSignupEnabled: form.selfSignupEnabled,
    owner: {
      email: form.ownerEmail.trim()
    }
  }

  if (trimmedSlug) {
    payload.slug = trimmedSlug
  }
  if (trimmedBilling) {
    payload.billingEmail = trimmedBilling
  }
  if (trimmedFullName) {
    payload.owner.fullName = trimmedFullName
  }
  if (trimmedPassword) {
    payload.owner.password = trimmedPassword
  }

  try {
    const response = await $fetch<AdminCreateOrganizationResponse>('/api/admin/organizations', {
      method: 'POST',
      body: payload
    })
    resultInfo.value = {
      organizationName: response.organization.name,
      ownerEmail: response.owner.email,
      generatedPassword: response.generatedPassword
    }
    const currentRole = form.defaultRole
    Object.assign(form, {
      name: '',
      slug: '',
      billingEmail: '',
      defaultRole: currentRole,
      enforceSso: false,
      selfSignupEnabled: false,
      ownerEmail: '',
      ownerFullName: '',
      ownerPassword: ''
    })
    await refresh()
  } catch (err) {
    formError.value =
      err instanceof Error ? err.message : 'Kunde inte skapa organisationen just nu.'
  } finally {
    formLoading.value = false
  }
}
</script>


