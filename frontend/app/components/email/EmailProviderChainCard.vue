<template>
  <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
    <header class="mb-4">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">{{ $t('adminTenants.email.chain.overview') }}</p>
      <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{{ $t('adminTenants.email.chain.title') }}</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        {{ $t('adminTenants.email.chain.description') }}
      </p>
    </header>

    <ol class="space-y-3">
      <li
        v-for="entry in props.chain"
        :key="`${entry.targetType}-${entry.targetKey}`"
        class="rounded-lg border border-slate-200 p-4 text-sm dark:border-white/10"
        :class="entry.isEffective ? 'bg-brand/5 border-brand/40 dark:bg-brand/10' : 'bg-white/60 dark:bg-white/5'"
      >
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ levelLabel(entry) }}
            </p>
            <p class="text-base font-semibold text-slate-900 dark:text-white">
              {{ entry.targetName || fallbackName(entry.targetType) }}
            </p>
          </div>
          <span
            class="rounded-full px-3 py-1 text-xs font-semibold"
            :class="entry.summary.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300'"
          >
            {{ entry.summary.isActive ? $t('adminTenants.email.chain.active') : $t('adminTenants.email.chain.inactive') }}
          </span>
        </div>

        <div class="mt-3 space-y-1 text-slate-600 dark:text-slate-300">
          <p v-if="entry.summary.fromEmail">
            <span class="font-medium">{{ $t('adminTenants.email.chain.from') }}</span> {{ entry.summary.fromName || $t('adminTenants.email.chain.notProvided') }} &lt;{{ entry.summary.fromEmail }}&gt;
          </p>
          <p v-else class="text-slate-400 dark:text-slate-500">{{ $t('adminTenants.email.chain.noSender') }}</p>
          <p>
            <span class="font-medium">{{ $t('adminTenants.email.chain.provider') }}</span>
            {{ entry.summary.providerType ? entry.summary.providerType.toUpperCase() : '–' }}
          </p>
        </div>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import type { EmailProviderChainEntry } from '~/types/admin'
import { useI18n } from '#imports'

const { t } = useI18n()

const props = defineProps<{
  chain: EmailProviderChainEntry[]
}>()

const levelLabel = (entry: EmailProviderChainEntry) => {
  const key = `adminTenants.email.chain.levels.${entry.targetType}`
  return t(key) ?? t('adminTenants.email.chain.level')
}

const fallbackName = (type: EmailProviderChainEntry['targetType']) => {
  if (type === 'global') {
    return t('adminTenants.email.chain.globalDefault')
  }
  return t(`adminTenants.email.chain.levels.${type}`)
}
</script>

