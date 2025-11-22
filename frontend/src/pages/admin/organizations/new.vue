<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
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
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Fakturering</label>
            <input
              v-model="form.billingEmail"
              type="email"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              placeholder="billing@example.com"
            />
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Standardroll</label>
            <select
              v-model="form.defaultRole"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            >
              <option v-for="role in roles" :key="role" :value="role">{{ role }}</option>
            </select>
          </div>
          <div class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10">
            <input id="require-sso" v-model="form.requireSso" type="checkbox" class="rounded border-slate-300 dark:border-white/20" />
            <label for="require-sso" class="text-sm text-slate-700 dark:text-slate-200">Kräv SSO för organisationen</label>
          </div>
          <div class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10">
            <input id="allow-signup" v-model="form.allowSelfSignup" type="checkbox" class="rounded border-slate-300 dark:border-white/20" />
            <label for="allow-signup" class="text-sm text-slate-700 dark:text-slate-200">Tillåt självregistrering</label>
          </div>
        </div>
      </div>

      <div v-show="currentStep === 2" class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Steg 2: Ägarkonto</h2>
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
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Ägaren får sätta sitt lösenord via inloggningslänk.</p>
          </div>
        </div>
      </div>

      <div v-if="errorMessage" class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
        {{ errorMessage }}
      </div>

      <div class="flex items-center justify-between">
        <button
          type="button"
          class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
          :disabled="currentStep === 1"
          @click="currentStep = Math.max(1, currentStep - 1)"
        >
          Föregående
        </button>

        <div class="flex gap-2">
          <button
            v-if="currentStep < 2"
            type="button"
            class="rounded-lg bg-brand/10 px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/20"
            :disabled="!canContinue"
            @click="currentStep = 2"
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
import { computed, reactive, ref, useRouter } from '#imports'
import { rbacRoles } from '~/constants/rbac'
import type { AdminCreateOrganizationResponse } from '~/types/admin'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const router = useRouter()
const roles = rbacRoles
const steps = [
  { id: 1, label: 'Organisationsdetaljer' },
  { id: 2, label: 'Ägarkonto' }
]

const currentStep = ref(1)
const submitting = ref(false)
const errorMessage = ref('')

const form = reactive({
  name: '',
  slug: '',
  billingEmail: '',
  defaultRole: roles[3],
  requireSso: false,
  allowSelfSignup: false,
  ownerEmail: '',
  ownerFullName: ''
})

const canContinue = computed(() => {
  if (currentStep.value === 1) {
    return Boolean(form.name.trim())
  }
  if (currentStep.value === 2) {
    return Boolean(form.ownerEmail.trim())
  }
  return true
})

const handleSubmit = async () => {
  if (!canContinue.value) {
    return
  }

  submitting.value = true
  errorMessage.value = ''

  try {
    const payload = {
      name: form.name.trim(),
      defaultRole: form.defaultRole,
      requireSso: form.requireSso,
      allowSelfSignup: form.allowSelfSignup,
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
    if (form.ownerFullName.trim()) {
      payload.owner.fullName = form.ownerFullName.trim()
    }

    const response = await $fetch<AdminCreateOrganizationResponse>('/api/admin/organizations', {
      method: 'POST',
      body: payload
    })

    await router.push({
      path: `/admin/organizations/${response.organization.slug}/overview`,
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

