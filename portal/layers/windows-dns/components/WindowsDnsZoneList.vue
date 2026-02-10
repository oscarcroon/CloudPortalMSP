<template>
  <section class="mod-windows-dns-panel space-y-4">
    <!-- Selection Mode Action Bar -->
    <header
      v-if="selectionMode"
      class="space-y-3 rounded-xl border border-brand/30 bg-brand/5 p-3 dark:bg-brand/10"
    >
      <!-- Top row: Search + Cancel -->
      <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div class="relative flex-1 max-w-sm">
          <Icon icon="mdi:magnify" class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            v-model="selectionSearch"
            type="text"
            :placeholder="$t('windowsDns.zoneList.searchToSelect')"
            class="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <button
          type="button"
          class="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          @click="exitSelectionMode"
        >
          <Icon icon="mdi:close" class="h-4 w-4" />
          {{ $t('windowsDns.zoneList.cancelSelection') }}
        </button>
      </div>
      
      <!-- Bottom row: Selection info + Actions -->
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-3">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-200">
            {{ $t('windowsDns.zoneList.selected', { count: selectedZones.length }) }}
          </span>
          <span v-if="selectionSearch && filteredZones.length !== zones.length" class="text-xs text-slate-500 dark:text-slate-400">
            ({{ $t('windowsDns.zoneList.filteredOf', { filtered: filteredZones.length, total: zones.length }) }})
          </span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <!-- Select all filtered -->
          <button
            type="button"
            class="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-300"
            @click="toggleSelectAllFiltered"
          >
            <Icon :icon="allFilteredSelected ? 'mdi:checkbox-marked' : 'mdi:checkbox-blank-outline'" class="h-4 w-4" />
            {{ allFilteredSelected ? $t('windowsDns.zoneList.deselectAll') : $t('windowsDns.zoneList.selectAllFiltered', { count: filteredZones.length }) }}
          </button>
          <!-- Export selected -->
          <button
            v-if="selectedZones.length > 0 && moduleRights?.canExport"
            type="button"
            class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="bulkExporting"
            @click="bulkExportZones"
          >
            <Icon :icon="bulkExporting ? 'mdi:loading' : selectedZones.length > 5 ? 'mdi:folder-zip' : 'mdi:download-multiple'" :class="{ 'animate-spin': bulkExporting }" class="h-4 w-4" />
            {{ selectedZones.length > 5 
              ? $t('windowsDns.zoneList.exportAsZip', { count: selectedZones.length })
              : $t('windowsDns.zoneList.exportSelected', { count: selectedZones.length }) 
            }}
          </button>
        </div>
      </div>
      
      <!-- Progress indicator during bulk export -->
      <div v-if="bulkExporting" class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
        <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div 
            class="h-full rounded-full bg-brand transition-all duration-300"
            :style="{ width: `${exportProgress}%` }"
          />
        </div>
        <span>{{ exportProgressText }}</span>
      </div>
    </header>

    <!-- Normal Header -->
    <header v-else class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {{ $t('windowsDns.zoneList.label') }}
        </p>
        <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-50">
          {{ $t('windowsDns.zoneList.title') }}
        </h2>
      </div>
      <div class="flex flex-col gap-2 md:flex-row md:items-center">
        <!-- Enter selection mode button (only if user can export) -->
        <button
          v-if="zones.length > 1 && moduleRights?.canExport"
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-300"
          @click="enterSelectionMode"
        >
          <Icon icon="mdi:checkbox-multiple-marked-outline" class="h-4 w-4" />
          {{ $t('windowsDns.zoneList.selectMultiple') }}
        </button>
        <button
          v-if="moduleRights?.canManageZones"
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
          @click="openCreateModal"
        >
          <Icon icon="mdi:plus-circle-outline" class="h-4 w-4" />
          {{ $t('windowsDns.zoneList.create') }}
        </button>
      </div>
    </header>

    <div v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">
      {{ $t('windowsDns.zoneList.loading') }}
    </div>

    <div v-else-if="zones.length === 0" class="text-sm text-slate-500 dark:text-slate-400">
      {{ $t('windowsDns.zoneList.noZones') }}
    </div>

    <div v-else class="grid gap-4 md:grid-cols-2">
      <!-- Selection mode: div with click handler -->
      <div
        v-if="selectionMode"
        v-for="(zone, index) in displayedZones"
        :key="zone.id"
        class="group rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm transition hover:-translate-y-[1px] dark:border-slate-700 dark:bg-slate-900"
        :class="{ 'ring-2 ring-brand': selectedZones.includes(zone.id) }"
        @click="(e) => handleZoneClick(zone.id, index, e)"
      >
        <div class="flex items-center justify-between gap-3">
          <!-- Selection checkbox (only in selection mode) -->
          <button
            type="button"
            class="flex-shrink-0 p-0.5 rounded transition hover:bg-slate-100 dark:hover:bg-slate-800"
            @click.stop="toggleZoneSelection(zone.id)"
          >
            <Icon 
              :icon="selectedZones.includes(zone.id) ? 'mdi:checkbox-marked' : 'mdi:checkbox-blank-outline'" 
              class="h-5 w-5" 
              :class="selectedZones.includes(zone.id) ? 'text-brand' : 'text-slate-400'"
            />
          </button>
          <div class="flex-1 min-w-0">
            <p class="text-lg font-medium text-slate-900 dark:text-slate-50">{{ zone.zoneName }}</p>
            <p v-if="zone.serverName" class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {{ zone.serverName }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <!-- Delegation status badge -->
            <span
              v-if="getDelegationStatus(zone.zoneName) === 'pending'"
              class="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
              :title="$t('windowsDns.zoneList.delegation.pendingTooltip', { missing: getMissingNameservers(zone.zoneName).join(', ') })"
            >
              <Icon icon="mdi:clock-outline" class="h-3 w-3 animate-pulse" />
              {{ $t('windowsDns.zoneList.delegation.pending') }}
            </span>
            <span
              v-else-if="getDelegationStatus(zone.zoneName) === 'active'"
              class="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300"
              :title="$t('windowsDns.zoneList.delegation.activeTooltip')"
            >
              <Icon icon="mdi:check-network-outline" class="h-3 w-3" />
              {{ $t('windowsDns.zoneList.delegation.active') }}
            </span>
            <!-- Ownership badge -->
            <span
              v-if="zone.owned"
              class="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300"
            >
              <Icon icon="mdi:check-circle" class="h-3 w-3" />
              {{ $t('windowsDns.zoneList.owned') }}
            </span>
            <span
              v-else-if="zone.claimable"
              class="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
            >
              <Icon icon="mdi:hand-pointing-right" class="h-3 w-3" />
              {{ $t('windowsDns.zoneList.claimable') }}
            </span>
          </div>
        </div>

        <!-- Pending delegation info -->
        <div
          v-if="getDelegationStatus(zone.zoneName) === 'pending' && getMissingNameservers(zone.zoneName).length > 0"
          class="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 dark:border-amber-700/50 dark:bg-amber-900/10"
        >
          <div class="flex items-start gap-2">
            <Icon icon="mdi:information-outline" class="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-amber-800 dark:text-amber-200">
                {{ $t('windowsDns.zoneList.delegation.actionRequired') }}
              </p>
              <p class="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                {{ $t('windowsDns.zoneList.delegation.updateNameservers') }}
              </p>
              <div class="mt-1.5 flex flex-wrap gap-1">
                <span
                  v-for="ns in getMissingNameservers(zone.zoneName)"
                  :key="ns"
                  class="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-xs font-mono text-amber-800 dark:bg-amber-800/30 dark:text-amber-200"
                >
                  {{ ns }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-3 flex items-center justify-between">
          <span v-if="recordCounts[zone.id] !== undefined" class="text-xs text-slate-500 dark:text-slate-400">
            {{ recordCounts[zone.id] }} {{ recordCounts[zone.id] === 1 ? $t('windowsDns.zoneList.record') : $t('windowsDns.zoneList.records') }}
          </span>
          <span v-else-if="loadingRecordCounts" class="text-xs text-slate-400 dark:text-slate-500">
            {{ $t('windowsDns.zoneList.loadingRecords') }}
          </span>
          <span v-else class="text-xs text-slate-400 dark:text-slate-500">
            &nbsp;
          </span>
        </div>
      </div>

      <!-- Normal mode: NuxtLink (entire card is clickable) -->
      <NuxtLink
        v-else
        v-for="zone in displayedZones"
        :key="zone.id"
        :to="isValidUuid(zone.id) ? `/dns/${zone.id}` : '#'"
        class="group block rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm transition hover:-translate-y-[1px] dark:border-slate-700 dark:bg-slate-900"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex-1 min-w-0">
            <p class="text-lg font-medium text-slate-900 dark:text-slate-50">{{ zone.zoneName }}</p>
            <p v-if="zone.serverName" class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {{ zone.serverName }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <!-- Delegation status badge -->
            <span
              v-if="getDelegationStatus(zone.zoneName) === 'pending'"
              class="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
              :title="$t('windowsDns.zoneList.delegation.pendingTooltip', { missing: getMissingNameservers(zone.zoneName).join(', ') })"
            >
              <Icon icon="mdi:clock-outline" class="h-3 w-3 animate-pulse" />
              {{ $t('windowsDns.zoneList.delegation.pending') }}
            </span>
            <span
              v-else-if="getDelegationStatus(zone.zoneName) === 'active'"
              class="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300"
              :title="$t('windowsDns.zoneList.delegation.activeTooltip')"
            >
              <Icon icon="mdi:check-network-outline" class="h-3 w-3" />
              {{ $t('windowsDns.zoneList.delegation.active') }}
            </span>
            <!-- Ownership badge -->
            <span
              v-if="zone.owned"
              class="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300"
            >
              <Icon icon="mdi:check-circle" class="h-3 w-3" />
              {{ $t('windowsDns.zoneList.owned') }}
            </span>
            <span
              v-else-if="zone.claimable"
              class="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
            >
              <Icon icon="mdi:hand-pointing-right" class="h-3 w-3" />
              {{ $t('windowsDns.zoneList.claimable') }}
            </span>
          </div>
        </div>

        <!-- Pending delegation info -->
        <div
          v-if="getDelegationStatus(zone.zoneName) === 'pending' && getMissingNameservers(zone.zoneName).length > 0"
          class="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 dark:border-amber-700/50 dark:bg-amber-900/10"
        >
          <div class="flex items-start gap-2">
            <Icon icon="mdi:information-outline" class="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-amber-800 dark:text-amber-200">
                {{ $t('windowsDns.zoneList.delegation.actionRequired') }}
              </p>
              <p class="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                {{ $t('windowsDns.zoneList.delegation.updateNameservers') }}
              </p>
              <div class="mt-1.5 flex flex-wrap gap-1">
                <span
                  v-for="ns in getMissingNameservers(zone.zoneName)"
                  :key="ns"
                  class="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-xs font-mono text-amber-800 dark:bg-amber-800/30 dark:text-amber-200"
                >
                  {{ ns }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-3 flex items-center justify-between">
          <span v-if="recordCounts[zone.id] !== undefined" class="text-xs text-slate-500 dark:text-slate-400">
            {{ recordCounts[zone.id] }} {{ recordCounts[zone.id] === 1 ? $t('windowsDns.zoneList.record') : $t('windowsDns.zoneList.records') }}
          </span>
          <span v-else-if="loadingRecordCounts" class="text-xs text-slate-400 dark:text-slate-500">
            {{ $t('windowsDns.zoneList.loadingRecords') }}
          </span>
          <span v-else class="text-xs text-slate-400 dark:text-slate-500">
            &nbsp;
          </span>
          <div class="flex items-center gap-2">
            <!-- Export button (visible on hover) -->
            <button
              v-if="isValidUuid(zone.id) && moduleRights?.canExport"
              type="button"
              class="inline-flex items-center justify-center rounded-lg border border-transparent p-1.5 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:border-slate-200 hover:bg-slate-50 hover:text-brand dark:hover:border-slate-700 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="exportingZoneId === zone.id"
              :title="$t('windowsDns.zoneList.export')"
              @click.stop="exportZone(zone)"
            >
              <Icon :icon="exportingZoneId === zone.id ? 'mdi:loading' : 'mdi:download'" :class="{ 'animate-spin': exportingZoneId === zone.id }" class="h-4 w-4" />
            </button>
            <span v-if="!isValidUuid(zone.id)" class="text-xs text-slate-400 dark:text-slate-500">
              {{ $t('windowsDns.zoneList.invalidZone') }}
            </span>
          </div>
        </div>
      </NuxtLink>
    </div>

    <!-- Create Zone Modal -->
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6"
      >
        <div class="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <header class="mb-4 flex items-start justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {{ $t('windowsDns.zoneList.onboard.label') }}
              </p>
              <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-50">
                {{ $t('windowsDns.zoneList.onboard.title') }}
              </h2>
              <p class="text-sm text-slate-600 dark:text-slate-300">
                {{ $t('windowsDns.zoneList.onboard.subtitle') }}
              </p>
            </div>
            <button
              class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-100"
              type="button"
              @click="closeCreateModal"
            >
              {{ $t('windowsDns.zoneList.onboard.cancel') }}
            </button>
          </header>

          <div class="space-y-3">
            <div class="grid gap-2">
              <label class="text-xs font-medium text-slate-600 dark:text-slate-300">
                {{ $t('windowsDns.zoneList.onboard.domainLabel') }}
              </label>
              <input
                v-model="newZone.zoneName"
                class="w-full rounded-lg border-2 border-brand/30 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-brand focus:ring-2 focus:ring-brand/30 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                type="text"
                :placeholder="$t('windowsDns.zoneList.onboard.domainPlaceholder')"
                required
              />
            </div>

            <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p class="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                {{ $t('windowsDns.zoneList.onboard.nameServersTitle') }}
              </p>
              <div class="space-y-2">
                <div
                  v-for="ns in ['ns1.coreit.se', 'ns2.coreit.se', 'ns3.coreit.se']"
                  :key="ns"
                  class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors"
                  :class="creating 
                    ? 'border-orange-300 bg-orange-50 dark:border-orange-600 dark:bg-orange-900/20' 
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'"
                >
                  <span 
                    class="font-mono text-sm font-medium transition-colors"
                    :class="creating 
                      ? 'text-orange-600 dark:text-orange-400' 
                      : 'text-slate-900 dark:text-slate-50'"
                    :style="creating ? { color: '#ea580c' } : undefined"
                  >{{ ns }}</span>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
                    :class="[
                      copiedNs === ns 
                        ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-900/20 dark:text-green-300'
                        : creating
                        ? 'border-orange-300 bg-orange-50 text-orange-700 hover:border-orange-400 hover:bg-orange-100 dark:border-orange-600 dark:bg-orange-900/20 dark:text-orange-300 dark:hover:border-orange-500 dark:hover:bg-orange-900/30'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-brand hover:bg-slate-50 hover:text-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-brand dark:hover:bg-slate-700'
                    ]"
                    @click="copyToClipboard(ns)"
                  >
                    <Icon
                      :icon="copiedNs === ns ? 'mdi:check' : 'mdi:content-copy'"
                      class="h-3.5 w-3.5"
                    />
                    {{ copiedNs === ns ? $t('windowsDns.zoneList.onboard.copied') : $t('windowsDns.zoneList.onboard.copy') }}
                  </button>
                </div>
              </div>
              <p class="mt-3 text-xs text-slate-600 dark:text-slate-400">
                {{ $t('windowsDns.zoneList.onboard.propagation') }}
              </p>
            </div>

            <div
              v-if="createError"
              class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
            >
              {{ createError }}
            </div>

            <div class="flex justify-end gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-100"
                @click="closeCreateModal"
              >
                {{ $t('windowsDns.zoneList.onboard.cancel') }}
              </button>
              <button
                type="button"
                :disabled="creating || !newZone.zoneName || !newZone.serverId"
                class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
                @click="createZone"
              >
                <Icon v-if="creating" icon="mdi:loading" class="h-4 w-4 animate-spin" />
                <Icon v-else icon="mdi:plus-circle-outline" class="h-4 w-4" />
                {{ $t('windowsDns.zoneList.onboard.createZone') }}
              </button>
              <button
                v-if="createdZoneId && isValidUuid(createdZoneId)"
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-4 py-2 text-sm font-semibold text-brand shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
                @click="goToCreatedZone"
              >
                <Icon icon="mdi:arrow-right" class="h-4 w-4" />
                {{ $t('windowsDns.zoneList.onboard.openZone') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import JSZip from 'jszip'

type Zone = {
  id: string
  zoneName: string
  serverId: string
  serverName: string
  zoneType: string
  owned: boolean
  claimable: boolean
}

type NameserverCheckStatus = {
  zoneId: string
  zoneName: string
  lastCheckedAt: number | null
  delegationNameservers: string[]
  pointsToOurNameservers: boolean
  ourNameserversDetected: string[]
  checkStatus: 'success' | 'error' | 'timeout'
  errorMessage: string | null
}

type NsStatusResponse = {
  success: boolean
  items: NameserverCheckStatus[]
  statusByZoneName: Record<string, NameserverCheckStatus>
  serviceUnavailable?: boolean
}

type Server = {
  id: string
  name: string
  baseUrl: string
  isEnabled: boolean
}

const props = defineProps<{
  zones: Zone[]
  moduleRights?: { canManageZones: boolean; canExport?: boolean }
  loading?: boolean
}>()

const emit = defineEmits<{ refresh: [] }>()
const router = useRouter()

// Validate that zoneId is a valid UUID
const isValidUuid = (id: string | null | undefined): boolean => {
  if (!id || id === 'null' || id === 'undefined') return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

// Record counts state
const recordCounts = ref<Record<string, number>>({})
const loadingRecordCounts = ref(false)

// NS check status state
const nsStatus = ref<Record<string, NameserverCheckStatus>>({})
const loadingNsStatus = ref(false)
const nsServiceUnavailable = ref(false)

// Export state
const exportingZoneId = ref<string | null>(null)
const bulkExporting = ref(false)
const selectedZones = ref<string[]>([])
const exportProgress = ref(0)
const exportProgressText = ref('')

// Selection mode state
const selectionMode = ref(false)
const selectionSearch = ref('')
const lastClickedIndex = ref<number | null>(null)

// Filtered zones based on search
const filteredZones = computed(() => {
  if (!selectionSearch.value.trim()) return props.zones
  const search = selectionSearch.value.toLowerCase().trim()
  return props.zones.filter(z => 
    z.zoneName.toLowerCase().includes(search) ||
    z.serverName?.toLowerCase().includes(search)
  )
})

// Displayed zones (filtered when in selection mode, all otherwise)
const displayedZones = computed(() => {
  return selectionMode.value ? filteredZones.value : props.zones
})

// Check if all filtered zones are selected
const allFilteredSelected = computed(() => {
  if (filteredZones.value.length === 0) return false
  return filteredZones.value.every(z => selectedZones.value.includes(z.id))
})

const enterSelectionMode = () => {
  selectionMode.value = true
  selectedZones.value = []
  selectionSearch.value = ''
  lastClickedIndex.value = null
}

const exitSelectionMode = () => {
  selectionMode.value = false
  selectedZones.value = []
  selectionSearch.value = ''
  lastClickedIndex.value = null
}

// Selection helpers
const toggleZoneSelection = (zoneId: string) => {
  const index = selectedZones.value.indexOf(zoneId)
  if (index === -1) {
    selectedZones.value.push(zoneId)
  } else {
    selectedZones.value.splice(index, 1)
  }
}

// Handle zone click with shift+click support for range selection
const handleZoneClick = (zoneId: string, index: number, event: MouseEvent) => {
  if (event.shiftKey && lastClickedIndex.value !== null) {
    // Range selection
    const start = Math.min(lastClickedIndex.value, index)
    const end = Math.max(lastClickedIndex.value, index)
    const zonesToSelect = displayedZones.value.slice(start, end + 1).map(z => z.id)
    
    // Add all zones in range to selection (without duplicates)
    for (const id of zonesToSelect) {
      if (!selectedZones.value.includes(id)) {
        selectedZones.value.push(id)
      }
    }
  } else {
    toggleZoneSelection(zoneId)
  }
  lastClickedIndex.value = index
}

// Toggle select all filtered zones
const toggleSelectAllFiltered = () => {
  if (allFilteredSelected.value) {
    // Deselect all filtered
    const filteredIds = new Set(filteredZones.value.map(z => z.id))
    selectedZones.value = selectedZones.value.filter(id => !filteredIds.has(id))
  } else {
    // Select all filtered (add to existing selection)
    for (const zone of filteredZones.value) {
      if (!selectedZones.value.includes(zone.id)) {
        selectedZones.value.push(zone.id)
      }
    }
  }
}

const toggleSelectAll = () => {
  if (selectedZones.value.length === props.zones.length) {
    selectedZones.value = []
  } else {
    selectedZones.value = props.zones.map(z => z.id)
  }
}

// Export single zone
const exportZone = async (zone: Zone) => {
  if (!isValidUuid(zone.id)) return
  
  exportingZoneId.value = zone.id
  try {
    const content = await ($fetch as any)(`/api/dns/windows/zones/${zone.id}/export`, {
      responseType: 'text'
    }) as string

    // Create and trigger download
    const blob = new Blob([content], { type: 'text/plain' })
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `${zone.zoneName.replace(/\./g, '_')}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(downloadUrl)
  } catch (err: any) {
    console.error('[windows-dns] Export failed:', err)
    // Could show a toast notification here
  } finally {
    exportingZoneId.value = null
  }
}

// Bulk export selected zones (ZIP if >5, individual files otherwise)
const bulkExportZones = async () => {
  if (selectedZones.value.length === 0) return
  
  bulkExporting.value = true
  exportProgress.value = 0
  exportProgressText.value = ''
  
  const useZip = selectedZones.value.length > 5
  let successCount = 0
  let failCount = 0
  const totalCount = selectedZones.value.length
  
  try {
    if (useZip) {
      // ZIP packaging for many zones
      const zip = new JSZip()
      const zoneFiles: { name: string; content: string }[] = []
      
      for (let i = 0; i < selectedZones.value.length; i++) {
        const zoneId = selectedZones.value[i]
        const zone = props.zones.find(z => z.id === zoneId)
        
        exportProgress.value = Math.round(((i + 1) / totalCount) * 100)
        exportProgressText.value = `${i + 1}/${totalCount}`
        
        if (!zone || !isValidUuid(zone.id)) {
          failCount++
          continue
        }
        
        try {
          const content = await ($fetch as any)(`/api/dns/windows/zones/${zone.id}/export`, {
            responseType: 'text'
          }) as string
          zoneFiles.push({
            name: `${zone.zoneName.replace(/\./g, '_')}.txt`,
            content
          })
          successCount++
        } catch (err) {
          console.error(`[windows-dns] Export failed for zone ${zone.zoneName}:`, err)
          failCount++
        }
      }
      
      // Add all files to ZIP
      for (const file of zoneFiles) {
        zip.file(file.name, file.content)
      }
      
      // Generate and download ZIP
      exportProgressText.value = 'Skapar ZIP...'
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const downloadUrl = URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = downloadUrl
      const timestamp = new Date().toISOString().slice(0, 10)
      link.download = `dns-zones-${timestamp}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(downloadUrl)
      
    } else {
      // Individual downloads for few zones
      for (let i = 0; i < selectedZones.value.length; i++) {
        const zoneId = selectedZones.value[i]
        const zone = props.zones.find(z => z.id === zoneId)
        
        exportProgress.value = Math.round(((i + 1) / totalCount) * 100)
        exportProgressText.value = `${i + 1}/${totalCount}`
        
        if (!zone || !isValidUuid(zone.id)) {
          failCount++
          continue
        }
        
        try {
          const content = await ($fetch as any)(`/api/dns/windows/zones/${zone.id}/export`, {
            responseType: 'text'
          }) as string

          // Create and trigger download
          const blob = new Blob([content], { type: 'text/plain' })
          const downloadUrl = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = downloadUrl
          link.download = `${zone.zoneName.replace(/\./g, '_')}.txt`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(downloadUrl)
          
          successCount++
          // Small delay between downloads to avoid browser blocking
          await new Promise(resolve => setTimeout(resolve, 300))
        } catch (err) {
          console.error(`[windows-dns] Export failed for zone ${zone.zoneName}:`, err)
          failCount++
        }
      }
    }
    
    console.log(`[windows-dns] Bulk export complete: ${successCount} success, ${failCount} failed`)
    // Exit selection mode after successful export
    if (failCount === 0) {
      exitSelectionMode()
    }
  } finally {
    bulkExporting.value = false
    exportProgress.value = 0
    exportProgressText.value = ''
  }
}

// Get delegation status for a zone
const getDelegationStatus = (zoneName: string): 'active' | 'pending' | 'error' | 'unknown' => {
  const status = nsStatus.value[zoneName.toLowerCase()]
  if (!status) return 'unknown'
  if (status.checkStatus === 'error' || status.checkStatus === 'timeout') return 'error'
  return status.pointsToOurNameservers ? 'active' : 'pending'
}

// Get missing nameservers for a zone
const getMissingNameservers = (zoneName: string): string[] => {
  const status = nsStatus.value[zoneName.toLowerCase()]
  if (!status) return []
  const detected = new Set(status.ourNameserversDetected.map(ns => ns.toLowerCase()))
  // Return nameservers that should be there but aren't detected
  const expected = ['ns1.coreit.se', 'ns2.coreit.se', 'ns3.coreit.se']
  return expected.filter(ns => !detected.has(ns.toLowerCase()))
}

// Fetch NS check status for all zones
const fetchNsStatus = async () => {
  loadingNsStatus.value = true
  try {
    const res = await ($fetch as any)('/api/dns/windows/zones/ns-status') as NsStatusResponse
    nsStatus.value = res.statusByZoneName ?? {}
    nsServiceUnavailable.value = res.serviceUnavailable ?? false
  } catch (err) {
    console.error('[windows-dns] Failed to fetch NS status:', err)
    nsServiceUnavailable.value = true
  } finally {
    loadingNsStatus.value = false
  }
}

// Fetch record counts for all zones
const fetchRecordCounts = async () => {
  if (props.zones.length === 0) return
  
  // Filter out zones with invalid IDs before fetching
  const validZones = props.zones.filter(zone => isValidUuid(zone.id))
  if (validZones.length === 0) return

  loadingRecordCounts.value = true
  try {
    const counts = await Promise.all(
      validZones.map(async (zone) => {
        try {
          const res = await ($fetch as any)(`/api/dns/windows/zones/${zone.id}/records`) as { records: any[] }
          return { zoneId: zone.id, count: res.records?.length ?? 0 }
        } catch (err) {
          console.error(`[windows-dns] Failed to fetch record count for zone ${zone.id}:`, err)
          return { zoneId: zone.id, count: 0 }
        }
      })
    )
    
    recordCounts.value = counts.reduce((acc, { zoneId, count }) => {
      acc[zoneId] = count
      return acc
    }, {} as Record<string, number>)
  } catch (err) {
    console.error('[windows-dns] Failed to fetch record counts:', err)
  } finally {
    loadingRecordCounts.value = false
  }
}

// Watch for zone changes and fetch counts + NS status
watch(() => props.zones, (newZones) => {
  if (newZones.length > 0) {
    fetchRecordCounts()
    fetchNsStatus()
  } else {
    recordCounts.value = {}
    nsStatus.value = {}
  }
}, { immediate: true })

// Create zone modal state
const showCreateModal = ref(false)
const creating = ref(false)
const createError = ref<string | null>(null)
const loadingServers = ref(false)
const servers = ref<Server[]>([])
const createdZoneId = ref<string | null>(null)
const copiedNs = ref<string | null>(null)
let copyTimeout: ReturnType<typeof setTimeout> | null = null

const newZone = reactive({
  zoneName: '',
  serverId: ''
})

const openCreateModal = async () => {
  showCreateModal.value = true
  createError.value = null
  createdZoneId.value = null
  copiedNs.value = null
  newZone.zoneName = ''
  newZone.serverId = ''
  if (copyTimeout) {
    clearTimeout(copyTimeout)
    copyTimeout = null
  }
  
  // Load available servers in background and auto-select first one
  loadingServers.value = true
  try {
    const res = await ($fetch as any)('/api/dns/windows/servers') as { servers: Server[] }
    servers.value = res.servers || []
    // Automatically select first available server (hidden from UI)
    if (servers.value.length > 0) {
      newZone.serverId = servers.value[0]!.id
    } else {
      const { $i18n } = useNuxtApp()
      createError.value = $i18n.t('windowsDns.zoneList.onboard.noServersError')
    }
  } catch (err: any) {
    console.error('[windows-dns] Failed to load servers:', err)
    const { $i18n } = useNuxtApp()
    createError.value = err?.data?.message || err?.message || $i18n.t('windowsDns.zoneList.onboard.noServersError')
  } finally {
    loadingServers.value = false
  }
}

const closeCreateModal = () => {
  showCreateModal.value = false
  createError.value = null
  createdZoneId.value = null
  copiedNs.value = null
  newZone.zoneName = ''
  if (copyTimeout) {
    clearTimeout(copyTimeout)
    copyTimeout = null
  }
}

const createZone = async () => {
  if (!newZone.zoneName || !newZone.serverId) return
  
  creating.value = true
  createError.value = null
  
  try {
    const res = await ($fetch as any)('/api/dns/windows/zones', {
      method: 'POST',
      body: {
        zoneName: newZone.zoneName,
        zoneType: 'Primary', // Always Primary
        serverId: newZone.serverId
      }
    }) as { zone: { id: string } }
    
    // Debug: Log the response structure
    console.log('[windows-dns] Frontend received response:', res)
    console.log('[windows-dns] Response type:', typeof res)
    console.log('[windows-dns] Response keys:', res ? Object.keys(res) : 'null')
    console.log('[windows-dns] res.zone:', (res as any)?.zone)
    console.log('[windows-dns] res.id (direct):', (res as any)?.id)
    
    // Try to extract zone ID - handle both { zone: { id } } and { id } formats
    let zoneId: string | null = null
    if ((res as any)?.zone?.id) {
      // Expected format: { zone: { id: "..." } }
      zoneId = (res as any).zone.id
      console.log('[windows-dns] Got zone.id from nested format:', zoneId)
    } else if ((res as any)?.id) {
      // Alternative format: { id: "..." } directly
      zoneId = (res as any).id
      console.log('[windows-dns] Got id from direct format:', zoneId)
    }
    
    if (!zoneId || !isValidUuid(zoneId)) {
      console.error('[windows-dns] Zone created but no valid ID returned:', res)
      createError.value = 'Zone was created but no valid ID was returned. Please refresh the zone list.'
      createdZoneId.value = null
    } else {
      createdZoneId.value = zoneId
      console.log('[windows-dns] Successfully set createdZoneId:', zoneId)
    }
    
    newZone.zoneName = ''
    emit('refresh')
  } catch (err: any) {
    console.error('[windows-dns] Failed to create zone:', err)
    createError.value = err?.data?.message || err?.message || 'Failed to create zone'
  } finally {
    creating.value = false
  }
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    // Show feedback
    copiedNs.value = text
    // Clear any existing timeout
    if (copyTimeout) {
      clearTimeout(copyTimeout)
    }
    // Reset feedback after 2 seconds
    copyTimeout = setTimeout(() => {
      copiedNs.value = null
    }, 2000)
  } catch (err) {
    console.error('[windows-dns] Failed to copy to clipboard:', err)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      // Show feedback even with fallback
      copiedNs.value = text
      if (copyTimeout) {
        clearTimeout(copyTimeout)
      }
      copyTimeout = setTimeout(() => {
        copiedNs.value = null
      }, 2000)
    } catch (fallbackErr) {
      console.error('[windows-dns] Fallback copy failed:', fallbackErr)
    }
    document.body.removeChild(textArea)
  }
}

const goToCreatedZone = () => {
  // Save the zone ID BEFORE closing the modal (which clears createdZoneId)
  const zoneId = createdZoneId.value
  
  // Guard: Only navigate if we have a valid UUID
  if (zoneId && isValidUuid(zoneId)) {
    closeCreateModal()
    void router.push(`/dns/${zoneId}`)
  } else {
    console.warn('[windows-dns] Cannot navigate: createdZoneId is invalid:', zoneId)
  }
}
</script>

<style scoped>
.mod-windows-dns-panel {
  @apply rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80;
}
</style>

