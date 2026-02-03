<template>
  <MemberAccessLayout>
    <div class="space-y-6">
      <div v-if="!currentOrgId" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
        {{ t('settings.groups.noOrg') }}
      </div>

      <div v-else class="grid gap-4 lg:grid-cols-3">
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <h2 class="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {{ t('settings.groups.createTitle') }}
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ t('settings.groups.createHint') }}
          </p>
          <form class="mt-3 space-y-3" @submit.prevent="createGroup">
            <div class="space-y-1">
              <label class="text-xs text-slate-500 dark:text-slate-300">
                {{ t('settings.groups.name') }}
              </label>
              <input
                v-model="form.name"
                type="text"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                :placeholder="t('settings.groups.namePlaceholder')"
                required
              />
            </div>
            <div class="space-y-1">
              <label class="text-xs text-slate-500 dark:text-slate-300">
                {{ t('settings.groups.descriptionLabel') }}
              </label>
              <input
                v-model="form.description"
                type="text"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                :placeholder="t('settings.groups.descriptionPlaceholder')"
              />
            </div>
            <button
              type="submit"
              class="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-600 disabled:opacity-60"
              :disabled="creating || !form.name.trim()"
            >
              <Icon icon="mdi:account-multiple-plus" class="mr-2 h-4 w-4" />
              {{ creating ? t('common.saving') : t('settings.groups.create') }}
            </button>
            <p v-if="errorMessage" class="text-xs text-red-600 dark:text-red-400">
              {{ errorMessage }}
            </p>
          </form>
        </div>

        <div class="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {{ t('settings.groups.listTitle') }}
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ t('settings.groups.listHint') }}
              </p>
            </div>
            <button
              class="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
              :disabled="pending"
              @click="() => refreshGroups()"
            >
              <Icon icon="mdi:refresh" class="h-4 w-4" />
              {{ t('common.refresh') ?? 'Refresh' }}
            </button>
          </div>

          <div v-if="pending" class="mt-3 text-sm text-slate-500 dark:text-slate-300">
            {{ t('settings.groups.loading') }}
          </div>
          <div v-else-if="groups.length === 0" class="mt-3 text-sm text-slate-500 dark:text-slate-300">
            {{ t('settings.groups.empty') }}
          </div>
          <div v-else class="mt-3 space-y-2">
            <div
              v-for="group in groups"
              :key="group.id"
              class="space-y-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <Icon icon="mdi:account-group-outline" class="h-4 w-4 text-slate-500 dark:text-slate-300" />
                    {{ group.name }}
                  </p>
                  <p v-if="group.description" class="text-xs text-slate-500 dark:text-slate-400">
                    {{ group.description }}
                  </p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {{ t('settings.groups.membersCount', { count: group.members.length }) }}
                  </p>
                  <div v-if="group.members.length" class="mt-1 flex flex-wrap gap-1">
                    <span
                      v-for="member in group.members"
                      :key="member.userId"
                      class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-white/10 dark:text-slate-200"
                    >
                      {{ member.fullName || member.email || member.userId }}
                    </span>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/10"
                    @click="toggleExpanded(group.id)"
                  >
                    {{ expanded[group.id] ? t('common.close') ?? 'Close' : t('settings.groups.manageMembers') }}
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50 dark:border-red-500/40 dark:text-red-200 dark:hover:bg-red-500/10"
                    @click="deleteGroup(group.id, group.name)"
                  >
                    {{ t('settings.groups.delete') }}
                  </button>
                </div>
              </div>

              <div
                v-if="expanded[group.id]"
                class="rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-sm dark:border-white/10 dark:bg-white/5"
              >
                <div class="space-y-1">
                  <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {{ t('settings.groups.availableMembers') }}
                  </label>
                  <div class="mt-1">
                    <input
                      v-model="memberSearch"
                      type="text"
                      class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                      :placeholder="t('settings.groups.searchPlaceholder') || 'E-post eller namn (söker automatiskt)'"
                    />
                  </div>
                  <div v-if="searchingMembers" class="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                    <div class="flex items-center gap-2">
                      <Icon icon="mdi:loading" class="h-4 w-4 animate-spin" />
                      <span>Söker...</span>
                    </div>
                  </div>
                  <div v-else-if="memberResults.length" class="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/5">
                    <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Träffar ({{ memberResults.length }})</p>
                    <label
                      v-for="member in memberResults"
                      :key="member.id"
                      class="flex cursor-pointer items-center justify-between rounded-lg bg-white px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:bg-black/20 dark:text-slate-100 dark:hover:bg-black/30"
                    >
                      <div class="flex items-center gap-2 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          class="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand dark:border-white/20"
                          :checked="isMemberChecked(group.id, member.id)"
                          @change="toggleMember(group.id, member.id)"
                        />
                        <div class="flex-1 min-w-0">
                          <p class="font-semibold truncate">{{ member.fullName || member.email }}</p>
                          <p class="text-xs text-slate-500 truncate">{{ member.email }}</p>
                        </div>
                      </div>
                    </label>
                  </div>
                  <p v-if="memberSearch.trim() && !searchingMembers && memberResults.length === 0" class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {{ t('settings.groups.noMembersFound') || 'Inga medlemmar hittades' }}
                  </p>
                </div>

                <div class="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-brand-600 disabled:opacity-60"
                    :disabled="savingMembers[group.id]"
                    @click="saveMembers(group.id)"
                  >
                    {{ savingMembers[group.id] ? t('common.saving') : t('settings.groups.saveMembers') }}
                  </button>
                  <button
                    type="button"
                    class="text-xs text-slate-500 underline-offset-2 hover:underline"
                    @click="resetMembersInput(group)"
                  >
                    {{ t('common.cancel') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </MemberAccessLayout>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { useI18n, useFetch } from '#imports'
import { useDebounceFn } from '@vueuse/core'
import { useAuth } from '~/composables/useAuth'
import type { AdminUsersResponse } from '~/types/admin'

const { t } = useI18n()
const auth = useAuth()
const currentOrgId = computed(() => auth.currentOrg.value?.id)

type GroupMember = { userId: string; email: string | null; fullName: string | null }
type GroupItem = { id: string; name: string; description: string | null; members: GroupMember[] }

const {
  data,
  pending,
  refresh: refreshGroups
} = await (useFetch as any)(() =>
  currentOrgId.value ? `/api/organizations/${currentOrgId.value}/groups` : (null as unknown as string)
)

const groups = computed(() => (data.value as { groups: GroupItem[] } | null)?.groups ?? [])

const memberSearch = ref('')
const memberResults = ref<AdminUsersResponse['users']>([])
const searchingMembers = ref(false)

const searchMembers = async () => {
  if (!memberSearch.value.trim()) {
    memberResults.value = []
    return
  }
  searchingMembers.value = true
  try {
    const res = await ($fetch as any)('/api/admin/users', {
      query: { q: memberSearch.value.trim() }
    })
    memberResults.value = res.users ?? []
  } catch (err: any) {
    memberResults.value = []
  } finally {
    searchingMembers.value = false
  }
}

// Debounced search function for live search
const debouncedSearch = useDebounceFn(searchMembers, 300)

// Watch memberSearch and trigger search automatically
watch(memberSearch, (newValue) => {
  if (newValue.trim()) {
    debouncedSearch()
  } else {
    memberResults.value = []
  }
})

const expanded = ref<Record<string, boolean>>({})
const memberInputs = ref<Record<string, string>>({})
const savingMembers = ref<Record<string, boolean>>({})

const form = ref({
  name: '',
  description: ''
})
const creating = ref(false)
const errorMessage = ref('')

const createGroup = async () => {
  if (!currentOrgId.value || !form.value.name.trim()) return
  creating.value = true
  errorMessage.value = ''
  try {
    await ($fetch as any)(`/api/organizations/${currentOrgId.value}/groups`, {
      method: 'POST',
      body: {
        name: form.value.name.trim(),
        description: form.value.description.trim() || undefined
      }
    })
    form.value.name = ''
    form.value.description = ''
    await refreshGroups()
  } catch (error: any) {
    errorMessage.value = error?.data?.message ?? error?.message ?? 'Kunde inte skapa gruppen.'
  } finally {
    creating.value = false
  }
}

const deleteGroup = async (groupId: string, groupName?: string) => {
  if (!currentOrgId.value) return
  const confirmed = window.confirm(
    groupName
      ? t('settings.groups.confirmDeleteNamed', { name: groupName })
      : t('settings.groups.confirmDelete')
  )
  if (!confirmed) return
  try {
    await ($fetch as any)(`/api/organizations/${currentOrgId.value}/groups/${groupId}/delete`, {
      method: 'DELETE'
    })
    await refreshGroups()
  } catch (error: any) {
    errorMessage.value = error?.data?.message ?? error?.message ?? 'Kunde inte ta bort gruppen.'
  }
}

const toggleExpanded = (groupId: string) => {
  const wasExpanded = expanded.value[groupId]
  // Close all other groups
  Object.keys(expanded.value).forEach((id) => {
    if (id !== groupId) {
      expanded.value[id] = false
    }
  })
  expanded.value[groupId] = !wasExpanded
  if (expanded.value[groupId]) {
    const group = groups.value.find((g: GroupItem) => g.id === groupId)
    resetMembersInput(group)
    // Clear search when opening a new group
    memberSearch.value = ''
    memberResults.value = []
  } else {
    // Clear search when closing
    memberSearch.value = ''
    memberResults.value = []
  }
}

const resetMembersInput = (group?: GroupItem) => {
  if (!group) return
  memberInputs.value[group.id] = group.members.map((m) => m.userId).join(', ')
}

const parseMemberIds = (input: string) =>
  input
    .split(/[\s,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)

const isMemberChecked = (groupId: string, userId: string) => {
  const ids = parseMemberIds(memberInputs.value[groupId] ?? '')
  return ids.includes(userId)
}

const setMemberIds = (groupId: string, ids: string[]) => {
  memberInputs.value[groupId] = ids.join(', ')
}

const toggleMember = (groupId: string, userId: string) => {
  const current = new Set(parseMemberIds(memberInputs.value[groupId] ?? ''))
  if (current.has(userId)) current.delete(userId)
  else current.add(userId)
  setMemberIds(groupId, Array.from(current))
}

const saveMembers = async (groupId: string) => {
  if (!currentOrgId.value) return
  const raw = memberInputs.value[groupId] ?? ''
  const memberIds = parseMemberIds(raw)
  savingMembers.value[groupId] = true
  try {
    await ($fetch as any)(`/api/organizations/${currentOrgId.value}/groups/${groupId}/members`, {
      method: 'PUT',
      body: { memberIds }
    })
    await refreshGroups()
    expanded.value[groupId] = false
  } catch (error: any) {
    errorMessage.value = error?.data?.message ?? error?.message ?? 'Kunde inte uppdatera medlemmar.'
  } finally {
    savingMembers.value[groupId] = false
  }
}
</script>

