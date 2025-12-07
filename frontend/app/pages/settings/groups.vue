<template>
  <section class="space-y-6">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
        {{ t('settings.administration') }}
      </p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">
        {{ t('settings.groups.title') }}
      </h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        {{ t('settings.groups.description') }}
      </p>
    </header>

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
            @click="refreshGroups"
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
                <p class="text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                  {{ t('settings.groups.availableMembers') }}
                </p>
                <input
                  v-model="memberSearch"
                  type="text"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                  :placeholder="t('settings.groups.searchPlaceholder')"
                />
                <p class="text-[12px] text-slate-500 dark:text-slate-400">
                  {{ t('settings.groups.searchHint') }}
                </p>
              </div>

              <label class="mt-3 block text-xs text-slate-500 dark:text-slate-300">
                {{ t('settings.groups.membersInputLabel') }}
              </label>
              <textarea
                v-model="memberInputs[group.id]"
                rows="2"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                :placeholder="t('settings.groups.membersPlaceholder')"
              />
              <p class="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                {{ t('settings.groups.membersHelpInline') }}
              </p>

              <div class="mt-3 space-y-1">
                <div class="max-h-40 space-y-1 overflow-auto rounded border border-slate-100 p-2 text-xs dark:border-white/10 dark:bg-white/5">
                  <template v-if="memberSearch.trim()">
                    <label
                      v-for="member in filteredMembers"
                      :key="member.userId"
                      class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-white/10"
                    >
                      <input
                        type="checkbox"
                        class="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                        :checked="isMemberChecked(group.id, member.userId)"
                        @change="toggleMember(group.id, member.userId)"
                      />
                      <span class="truncate text-slate-700 dark:text-slate-100">
                        {{ member.fullName || member.email || member.userId }}
                      </span>
                      <span class="text-slate-400 dark:text-slate-400">({{ member.userId }})</span>
                    </label>
                    <p v-if="memberSearch.trim() && filteredMembers.length === 0" class="px-1 text-[12px] text-slate-500 dark:text-slate-400">
                      {{ t('settings.groups.noMembersFound') }}
                    </p>
                    <p v-if="memberSearch.trim() && filteredMembers.length === memberSearchLimit" class="px-1 text-[12px] text-slate-500 dark:text-slate-400">
                      {{ t('settings.groups.searchLimit', { count: memberSearchLimit }) }}
                    </p>
                  </template>
                </div>
              </div>
              <div class="mt-2 flex items-center gap-3">
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
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useI18n, useFetch } from '#imports'
import { useAuth } from '~/composables/useAuth'

const { t } = useI18n()
const auth = useAuth()
const currentOrgId = computed(() => auth.currentOrg.value?.id)

type GroupMember = { userId: string; email: string | null; fullName: string | null }
type GroupItem = { id: string; name: string; description: string | null; members: GroupMember[] }

const {
  data,
  pending,
  refresh: refreshGroups
} = await useFetch<{ organizationId: string; groups: GroupItem[] }>(() =>
  currentOrgId.value ? `/api/organizations/${currentOrgId.value}/groups` : null
)

const groups = computed(() => data.value?.groups ?? [])

const { data: membersData } = await useFetch<{ organizationId: string; members: GroupMember[] }>(() =>
  currentOrgId.value ? `/api/organizations/${currentOrgId.value}/members` : null
)
const allMembers = computed(() => membersData.value?.members ?? [])
const memberSearch = ref('')
const memberSearchLimit = 50
const filteredMembers = computed(() => {
  const q = memberSearch.value.trim().toLowerCase()
  if (!q) return []
  return allMembers.value
    .filter((m) => {
      return (
        m.fullName?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.userId.toLowerCase().includes(q)
      )
    })
    .slice(0, memberSearchLimit)
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
    await $fetch(`/api/organizations/${currentOrgId.value}/groups`, {
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
    await $fetch(`/api/organizations/${currentOrgId.value}/groups/${groupId}/delete`, {
      method: 'DELETE'
    })
    await refreshGroups()
  } catch (error: any) {
    errorMessage.value = error?.data?.message ?? error?.message ?? 'Kunde inte ta bort gruppen.'
  }
}

const toggleExpanded = (groupId: string) => {
  expanded.value[groupId] = !expanded.value[groupId]
  if (expanded.value[groupId]) {
    const group = groups.value.find((g) => g.id === groupId)
    resetMembersInput(group)
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
    await $fetch(`/api/organizations/${currentOrgId.value}/groups/${groupId}/members`, {
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

