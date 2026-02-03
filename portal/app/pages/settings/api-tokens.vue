<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <NuxtLink
        to="/settings"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        ← Tillbaka till inställningar
      </NuxtLink>
      <div>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">API-nycklar</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          Hantera API-nycklar för programmatisk åtkomst till organisationens data.
        </p>
      </div>
    </header>

    <ClientOnly>
      <div v-if="!currentOrgId" class="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-300">
        Välj en organisation först för att hantera API-nycklar.
      </div>

      <div v-else class="space-y-6">
        <!-- Header with actions -->
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Aktiv organisation</p>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ organisationName }}</h2>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              class="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
              :disabled="loading"
              @click="refreshTokens"
            >
              <Icon icon="mdi:refresh" class="h-4 w-4" :class="{ 'animate-spin': loading }" />
              {{ loading ? 'Laddar...' : 'Uppdatera' }}
            </button>
            <button
              class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!canManageTokens"
              @click="openCreateModal"
            >
              <Icon icon="mdi:plus" class="h-4 w-4" />
              Skapa ny API-nyckel
            </button>
          </div>
        </div>

        <!-- Error/Success messages -->
        <div v-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/5 dark:text-red-200">
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/5 dark:text-emerald-200">
          {{ successMessage }}
        </div>

        <!-- Token list -->
        <div class="rounded-2xl border border-slate-200 bg-white shadow-card dark:border-white/10 dark:bg-[#0c1524]">
          <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold text-slate-900 dark:text-white">API-nycklar</p>
              <span class="text-xs text-slate-500 dark:text-slate-400">
                {{ tokens.length }} {{ tokens.length === 1 ? 'nyckel' : 'nycklar' }}
              </span>
            </div>
          </div>

          <!-- Loading state -->
          <div v-if="loading && tokens.length === 0" class="flex items-center justify-center py-12">
            <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          </div>

          <!-- Empty state -->
          <div
            v-else-if="tokens.length === 0"
            class="flex flex-col items-center justify-center px-6 py-12 text-center"
          >
            <Icon icon="mdi:key-variant" class="mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
            <p class="text-sm font-medium text-slate-900 dark:text-white">Inga API-nycklar</p>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Skapa en API-nyckel för att komma igång med programmatisk åtkomst.
            </p>
            <button
              class="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90"
              :disabled="!canManageTokens"
              @click="openCreateModal"
            >
              <Icon icon="mdi:plus" class="h-4 w-4" />
              Skapa första API-nyckeln
            </button>
          </div>

          <!-- Token table -->
          <div v-else class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-white/5 dark:text-slate-400">
                <tr>
                  <th class="px-6 py-3">Prefix</th>
                  <th class="px-6 py-3">Beskrivning</th>
                  <th class="px-6 py-3">Scopes</th>
                  <th class="px-6 py-3">Skapad</th>
                  <th class="px-6 py-3">Senast använd</th>
                  <th class="px-6 py-3">Status</th>
                  <th class="px-6 py-3 text-right">Åtgärder</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-white/5">
                <tr
                  v-for="token in tokens"
                  :key="token.id"
                  class="hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <td class="whitespace-nowrap px-6 py-4">
                    <code class="rounded bg-slate-100 px-2 py-1 font-mono text-xs dark:bg-slate-800">
                      msp_pat.{{ token.prefix }}...
                    </code>
                  </td>
                  <td class="px-6 py-4 text-slate-700 dark:text-slate-300">
                    {{ token.description || '—' }}
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex flex-wrap gap-1">
                      <span
                        v-for="scope in token.scopes.slice(0, 3)"
                        :key="scope"
                        class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      >
                        {{ scope }}
                      </span>
                      <span
                        v-if="token.scopes.length > 3"
                        class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                      >
                        +{{ token.scopes.length - 3 }}
                      </span>
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-6 py-4 text-slate-500 dark:text-slate-400">
                    {{ formatDate(token.createdAt) }}
                    <span v-if="token.createdBy" class="block text-xs">
                      av {{ token.createdBy.name || token.createdBy.email }}
                    </span>
                  </td>
                  <td class="whitespace-nowrap px-6 py-4 text-slate-500 dark:text-slate-400">
                    {{ token.lastUsedAt ? formatDate(token.lastUsedAt) : 'Aldrig' }}
                  </td>
                  <td class="whitespace-nowrap px-6 py-4">
                    <span
                      :class="[
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                        token.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                          : token.status === 'expired'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                      ]"
                    >
                      {{ token.status === 'active' ? 'Aktiv' : token.status === 'expired' ? 'Utgången' : 'Återkallad' }}
                    </span>
                    <span
                      v-if="token.expiresAt && token.status === 'active'"
                      class="block mt-1 text-xs text-slate-400"
                    >
                      Utgår {{ formatDate(token.expiresAt) }}
                    </span>
                  </td>
                  <td class="whitespace-nowrap px-6 py-4 text-right">
                    <button
                      v-if="token.status === 'active'"
                      class="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                      :disabled="revokingTokenId === token.id"
                      @click="confirmRevoke(token)"
                    >
                      <Icon v-if="revokingTokenId === token.id" icon="mdi:loading" class="h-3 w-3 animate-spin" />
                      <Icon v-else icon="mdi:cancel" class="h-3 w-3" />
                      Återkalla
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Info box -->
        <div class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-500/30 dark:bg-blue-500/5">
          <div class="flex gap-3">
            <Icon icon="mdi:information-outline" class="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <div class="text-sm text-blue-700 dark:text-blue-300">
              <p class="font-medium">Om API-nycklar</p>
              <ul class="mt-1 list-inside list-disc space-y-1 text-xs">
                <li>API-nycklar ger programmatisk åtkomst till organisationens data.</li>
                <li>Nyckeln visas <strong>endast en gång</strong> vid skapande – spara den säkert!</li>
                <li>Använd <code class="rounded bg-blue-100 px-1 dark:bg-blue-900/50">Authorization: Bearer &lt;token&gt;</code> i API-anrop.</li>
                <li>Återkallade nycklar kan inte återaktiveras.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </ClientOnly>

    <!-- Create Token Modal -->
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
        @click.self="closeCreateModal"
      >
        <form
          class="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900"
          @submit.prevent="handleCreate"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Ny</p>
              <h3 class="text-xl font-semibold text-slate-900 dark:text-white">Skapa API-nyckel</h3>
            </div>
            <button type="button" class="text-slate-400 transition hover:text-slate-600 dark:text-slate-500" @click="closeCreateModal">
              <Icon icon="mdi:close" class="h-5 w-5" />
            </button>
          </div>

          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Beskrivning (valfritt)</label>
            <input
              v-model="createForm.description"
              type="text"
              maxlength="256"
              class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-slate-800 dark:text-white"
              placeholder="T.ex. CI/CD Pipeline, Extern integration"
            />
          </div>

          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Behörigheter (scopes)</label>
            <div class="mt-2 space-y-2 rounded-lg border border-slate-200 p-3 dark:border-white/10">
              <label
                v-for="(desc, scope) in availableScopes"
                :key="scope"
                class="flex items-start gap-3 text-sm"
              >
                <input
                  v-model="createForm.scopes"
                  type="checkbox"
                  :value="scope"
                  class="mt-1 rounded border-slate-300 text-brand focus:ring-brand dark:border-white/20"
                />
                <span>
                  <code class="font-mono text-xs text-brand">{{ scope }}</code>
                  <span class="block text-xs text-slate-500 dark:text-slate-400">{{ desc }}</span>
                </span>
              </label>
            </div>
            <p v-if="createForm.scopes.length === 0" class="mt-1 text-xs text-red-500">
              Välj minst en behörighet
            </p>
          </div>

          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Utgångsdatum (valfritt)</label>
            <input
              v-model="createForm.expiresAt"
              type="date"
              :min="minExpiryDate"
              class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-slate-800 dark:text-white"
            />
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Lämna tomt för en nyckel utan utgångsdatum.
            </p>
          </div>

          <div v-if="createError" class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
            {{ createError }}
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
              @click="closeCreateModal"
            >
              Avbryt
            </button>
            <button
              type="submit"
              class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80 disabled:opacity-60"
              :disabled="createLoading || createForm.scopes.length === 0"
            >
              {{ createLoading ? 'Skapar...' : 'Skapa nyckel' }}
            </button>
          </div>
        </form>
      </div>
    </Teleport>

    <!-- Token Created Modal (show token once) -->
    <Teleport to="body">
      <div
        v-if="showTokenCreatedModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
      >
        <div class="w-full max-w-lg space-y-4 rounded-2xl border border-emerald-200 bg-white p-6 shadow-2xl dark:border-emerald-500/30 dark:bg-slate-900">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
              <Icon icon="mdi:check" class="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">API-nyckel skapad!</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">Kopiera och spara nyckeln nedan.</p>
            </div>
          </div>

          <div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <Icon icon="mdi:alert-outline" class="mr-1 inline-block h-4 w-4" />
            <strong>Viktigt:</strong> Denna nyckel visas endast en gång. Spara den på ett säkert ställe!
          </div>

          <div class="relative">
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Din API-nyckel</label>
            <div class="mt-1 flex gap-2">
              <input
                ref="tokenInput"
                :value="createdToken"
                type="text"
                readonly
                class="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                @click="copyToken"
              >
                <Icon :icon="copied ? 'mdi:check' : 'mdi:content-copy'" class="h-4 w-4" />
                {{ copied ? 'Kopierat!' : 'Kopiera' }}
              </button>
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <button
              type="button"
              class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80"
              @click="closeTokenCreatedModal"
            >
              Jag har sparat nyckeln
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Revoke Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showRevokeModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
        @click.self="closeRevokeModal"
      >
        <div class="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
              <Icon icon="mdi:alert-outline" class="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Återkalla API-nyckel?</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">Denna åtgärd kan inte ångras.</p>
            </div>
          </div>

          <p class="text-sm text-slate-600 dark:text-slate-300">
            Är du säker på att du vill återkalla nyckeln
            <code class="rounded bg-slate-100 px-1 dark:bg-slate-800">msp_pat.{{ tokenToRevoke?.prefix }}...</code>?
            <span v-if="tokenToRevoke?.description" class="block mt-1 text-slate-500">
              Beskrivning: {{ tokenToRevoke.description }}
            </span>
          </p>

          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
              @click="closeRevokeModal"
            >
              Avbryt
            </button>
            <button
              type="button"
              class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              :disabled="revokingTokenId !== null"
              @click="handleRevoke"
            >
              {{ revokingTokenId ? 'Återkallar...' : 'Återkalla' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from '#imports'
import { Icon } from '@iconify/vue'
import { useAuth } from '~/composables/useAuth'
import { usePermission } from '~/composables/usePermission'

// Types
interface ApiToken {
  id: string
  prefix: string
  description: string | null
  scopes: string[]
  resourceConstraints: Record<string, unknown> | null
  createdBy: {
    userId: string
    email: string | null
    name: string | null
  } | null
  expiresAt: number | null
  revokedAt: number | null
  lastUsedAt: number | null
  createdAt: number
  status: 'active' | 'expired' | 'revoked'
}

interface CreateTokenResponse {
  id: string
  token: string
  prefix: string
  description: string | null
  scopes: string[]
  resourceConstraints: Record<string, unknown> | null
  expiresAt: number | null
  createdAt: number
  message: string
}

// Composables
const auth = useAuth()
const { can } = usePermission()

// State
const tokens = ref<ApiToken[]>([])
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Create modal
const showCreateModal = ref(false)
const createLoading = ref(false)
const createError = ref('')
const createForm = ref({
  description: '',
  scopes: [] as string[],
  expiresAt: '',
})

// Token created modal
const showTokenCreatedModal = ref(false)
const createdToken = ref('')
const copied = ref(false)

// Revoke modal
const showRevokeModal = ref(false)
const tokenToRevoke = ref<ApiToken | null>(null)
const revokingTokenId = ref<string | null>(null)

// Available scopes
const availableScopes: Record<string, string> = {
  'user:read': 'Läsa användarinformation',
  'org:read': 'Läsa organisationsinformation',
  'org:write': 'Uppdatera organisationsinställningar',
  'dns:read': 'Läsa DNS-zoner och poster',
  'dns:write': 'Skapa, uppdatera och ta bort DNS-poster',
  'modules:read': 'Läsa modulkonfiguration',
}

// Computed
const currentOrgId = computed(() => auth.state.value.data?.currentOrgId ?? null)
const organisationName = computed(() => auth.currentOrg.value?.name ?? 'Organisation')
const canManageTokens = computed(() => can('org:manage').value)

const minExpiryDate = computed(() => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow.toISOString().split('T')[0]
})

// Methods
async function refreshTokens() {
  if (!currentOrgId.value) return

  loading.value = true
  errorMessage.value = ''

  try {
    const response = await ($fetch as any)(
      `/api/organizations/${currentOrgId.value}/api-tokens`
    )
    tokens.value = response.tokens
  } catch (err: any) {
    errorMessage.value = err?.data?.message || 'Kunde inte ladda API-nycklar'
    console.error('Failed to load tokens:', err)
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  createForm.value = { description: '', scopes: [], expiresAt: '' }
  createError.value = ''
  showCreateModal.value = true
}

function closeCreateModal() {
  showCreateModal.value = false
}

async function handleCreate() {
  if (createForm.value.scopes.length === 0) {
    createError.value = 'Välj minst en behörighet'
    return
  }

  createLoading.value = true
  createError.value = ''

  try {
    const payload: {
      scopes: string[]
      description?: string
      expiresAt?: number
    } = {
      scopes: createForm.value.scopes,
    }

    if (createForm.value.description.trim()) {
      payload.description = createForm.value.description.trim()
    }

    if (createForm.value.expiresAt) {
      // Convert date string to timestamp (end of day)
      const date = new Date(createForm.value.expiresAt)
      date.setHours(23, 59, 59, 999)
      payload.expiresAt = date.getTime()
    }

    const response = await ($fetch as any)(
      `/api/organizations/${currentOrgId.value}/api-tokens`,
      {
        method: 'POST',
        body: payload,
      }
    )

    // Show the created token
    createdToken.value = response.token
    showCreateModal.value = false
    showTokenCreatedModal.value = true

    // Refresh list
    await refreshTokens()
  } catch (err: any) {
    createError.value = err?.data?.message || 'Kunde inte skapa API-nyckel'
    console.error('Failed to create token:', err)
  } finally {
    createLoading.value = false
  }
}

function closeTokenCreatedModal() {
  showTokenCreatedModal.value = false
  createdToken.value = ''
  copied.value = false
  successMessage.value = 'API-nyckel skapad!'
  setTimeout(() => { successMessage.value = '' }, 5000)
}

async function copyToken() {
  try {
    await navigator.clipboard.writeText(createdToken.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

function confirmRevoke(token: ApiToken) {
  tokenToRevoke.value = token
  showRevokeModal.value = true
}

function closeRevokeModal() {
  showRevokeModal.value = false
  tokenToRevoke.value = null
}

async function handleRevoke() {
  if (!tokenToRevoke.value) return

  revokingTokenId.value = tokenToRevoke.value.id

  try {
    await ($fetch as any)(`/api/organizations/${currentOrgId.value}/api-tokens/${tokenToRevoke.value.id}/revoke`, {
      method: 'POST',
    })

    showRevokeModal.value = false
    successMessage.value = 'API-nyckel återkallad!'
    setTimeout(() => { successMessage.value = '' }, 5000)

    // Refresh list
    await refreshTokens()
  } catch (err: any) {
    errorMessage.value = err?.data?.message || 'Kunde inte återkalla API-nyckel'
    console.error('Failed to revoke token:', err)
  } finally {
    revokingTokenId.value = null
    tokenToRevoke.value = null
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Lifecycle
onMounted(() => {
  if (currentOrgId.value) {
    refreshTokens()
  }
})
</script>

