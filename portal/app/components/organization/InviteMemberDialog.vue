<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
      @click.self="emitClose"
    >
      <form
        class="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900"
        @submit.prevent="handleSubmit"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Inbjudan</p>
            <h3 class="text-xl font-semibold text-slate-900 dark:text-white">Bjud in medlem</h3>
          </div>
          <button type="button" class="text-slate-400 transition hover:text-slate-600 dark:text-slate-500" @click="emitClose">
            Stäng
          </button>
        </div>

        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">E-postadress</label>
          <input
            v-model="form.email"
            type="email"
            required
            class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-slate-800 dark:text-white"
            placeholder="namn@example.com"
          />
        </div>

        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Roll</label>
          <select
            v-model="form.role"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-slate-800 dark:text-white"
          >
            <option v-for="role in roles" :key="role" :value="role">
              {{ role }}
            </option>
          </select>
        </div>

        <label
          v-if="canDirectAdd"
          class="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:text-slate-300"
        >
          <input
            v-model="form.directAdd"
            type="checkbox"
            class="mt-1 rounded border-slate-300 dark:border-white/20"
          />
          <span>
            Aktivera direkt utan e-postlänk
            <span class="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
              Endast tillgängligt när SSO krävs.
            </span>
          </span>
        </label>

        <div v-if="error" class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          {{ error }}
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            @click="emitClose"
          >
            Avbryt
          </button>
          <button
            type="submit"
            class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80 disabled:opacity-60"
            :disabled="loading"
          >
            {{ loading ? 'Skickar...' : 'Skicka inbjudan' }}
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { reactive, watch } from '#imports'
import type { InviteMemberPayload, OrganizationMemberRole } from '~/types/members'

const props = defineProps<{
  open: boolean
  loading?: boolean
  error?: string
  roles: OrganizationMemberRole[]
  canDirectAdd?: boolean
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'submit', payload: InviteMemberPayload): void
}>()

const form = reactive<InviteMemberPayload>({
  email: '',
  role: props.roles[0] ?? 'member',
  directAdd: false
})

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      form.email = ''
      form.role = props.roles[0] ?? 'member'
      form.directAdd = Boolean(props.canDirectAdd)
    }
  }
)

watch(
  () => props.roles,
  (nextRoles) => {
    if (!nextRoles.includes(form.role)) {
      form.role = nextRoles[0] ?? 'member'
    }
  }
)

watch(
  () => props.canDirectAdd,
  (allowed) => {
    if (!allowed) {
      form.directAdd = false
    }
  }
)

const emitClose = () => emit('close')

const handleSubmit = () => {
  emit('submit', {
    email: form.email.trim(),
    role: form.role,
    directAdd: props.canDirectAdd ? form.directAdd : false
  })
}
</script>


