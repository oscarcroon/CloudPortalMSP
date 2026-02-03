<template>
  <section class="space-y-8">
    <!-- Top Bar -->
    <header class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
          {{ t('admin.tenantAdmin.label') }}
        </p>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          {{ t('admin.tenantAdmin.title') }}
        </h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ t('admin.tenantAdmin.subtitle') }}
        </p>
      </div>
      <div v-if="isSuperAdmin" class="flex flex-wrap items-center gap-3">
        <!-- Superadmin link -->
        <NuxtLink
          to="/platform-admin"
          class="inline-flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 transition hover:bg-purple-100 dark:border-purple-500/50 dark:bg-purple-500/20 dark:text-purple-300 dark:hover:bg-purple-500/30"
        >
          <Icon icon="mdi:shield-crown" class="h-4 w-4" />
          {{ t('admin.tenantAdmin.platformAdmin') }}
        </NuxtLink>
      </div>
    </header>

    <!-- Main Grid -->
    <div class="grid gap-6 lg:grid-cols-12">
      <!-- Left Column (8 cols) -->
      <div class="space-y-6 lg:col-span-8">
        <!-- Tenant Overview Card -->
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/70">
          <!-- Has tenant -->
          <div v-if="currentTenant" class="space-y-4">
            <!-- Tenant name and info -->
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div class="flex items-center gap-4">
                <div class="flex h-12 w-12 items-center justify-center rounded-xl" :class="tenantTypeColor">
                  <Icon :icon="tenantTypeIcon" class="h-6 w-6" />
                </div>
                <div>
                  <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">{{ currentTenant.name }}</h2>
                  <div class="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                    <span class="capitalize">{{ currentTenant.type }}</span>
                    <span class="font-mono text-xs">{{ currentTenant.id.substring(0, 12) }}…</span>
                  </div>
                </div>
              </div>
              <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                <NuxtLink
                  :to="`/tenant-admin/tenants/${currentTenant.id}`"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  <Icon icon="mdi:open-in-new" class="h-4 w-4 flex-shrink-0" />
                  {{ t('admin.tenantAdmin.overview.viewDetails') }}
                </NuxtLink>
                <NuxtLink
                  to="/tenant-admin/tenants"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  <Icon icon="mdi:sitemap" class="h-4 w-4 flex-shrink-0" />
                  {{ t('admin.tenantAdmin.overview.viewTenantTree') }}
                </NuxtLink>
              </div>
            </div>

            <!-- Stats -->
            <div class="grid gap-4 sm:grid-cols-3">
              <NuxtLink
                :to="`/tenant-admin/tenants/${currentTenant.id}`"
                class="rounded-lg border border-slate-100 bg-slate-50 p-4 transition hover:border-brand/30 hover:bg-brand/5 dark:border-white/5 dark:bg-white/5 dark:hover:border-brand/30 dark:hover:bg-brand/10"
              >
                <p class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ overviewPrimaryCount }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ overviewPrimaryLabel }}</p>
              </NuxtLink>
              <NuxtLink
                :to="`/tenant-admin/tenants/${currentTenant.id}/members`"
                class="rounded-lg border border-slate-100 bg-slate-50 p-4 transition hover:border-brand/30 hover:bg-brand/5 dark:border-white/5 dark:bg-white/5 dark:hover:border-brand/30 dark:hover:bg-brand/10"
              >
                <p class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ memberCount ?? '—' }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('admin.tenantAdmin.overview.members') }}</p>
              </NuxtLink>
              <NuxtLink
                :to="`/tenant-admin/tenants/${currentTenant.id}/modules`"
                class="rounded-lg border border-slate-100 bg-slate-50 p-4 transition hover:border-brand/30 hover:bg-brand/5 dark:border-white/5 dark:bg-white/5 dark:hover:border-brand/30 dark:hover:bg-brand/10"
              >
                <p class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ activeModulesCount ?? '—' }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('admin.tenantAdmin.overview.modules') }}</p>
              </NuxtLink>
            </div>
          </div>

          <!-- Empty state: no tenant -->
          <div v-else class="flex flex-col items-center justify-center py-8 text-center">
            <div class="rounded-full bg-slate-100 p-4 dark:bg-white/10">
              <Icon icon="mdi:office-building-remove-outline" class="h-10 w-10 text-slate-400" />
            </div>
            <h3 class="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {{ t('admin.tenantAdmin.emptyState.title') }}
            </h3>
            <p class="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              {{ t('admin.tenantAdmin.emptyState.description') }}
            </p>
          </div>
        </div>

        <!-- Tenant Actions Card -->
        <div v-if="currentTenant" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/70">
          <div class="flex items-center gap-3">
            <Icon icon="mdi:tools" class="h-6 w-6 text-brand" />
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {{ t('admin.tenantAdmin.tenantActions.title') }}
            </h2>
          </div>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {{ t('admin.tenantAdmin.tenantActions.description', { tenant: currentTenant.name }) }}
          </p>
          <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <QuickLinkTile
              v-for="action in tenantActions"
              :key="action.to"
              :to="action.to"
              :icon="action.icon"
              :label="action.label"
              :description="action.description"
              :disabled="action.disabled"
            />
          </div>
        </div>

        <!-- Operations & News Card -->
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/70">
          <div class="flex items-center gap-3">
            <Icon icon="mdi:bell-ring-outline" class="h-6 w-6 text-brand" />
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {{ t('admin.tenantAdmin.operations.title') }}
            </h2>
          </div>

          <!-- Tabs -->
          <div class="mt-4 flex gap-4 border-b border-slate-200 dark:border-white/10">
            <button
              class="relative pb-3 text-sm font-medium transition"
              :class="activeTab === 'incidents' ? 'text-brand' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
              @click="activeTab = 'incidents'"
            >
              {{ t('admin.tenantAdmin.operations.incidents') }}
              <span
                v-if="activeTab === 'incidents'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-brand"
              />
            </button>
            <button
              class="relative pb-3 text-sm font-medium transition"
              :class="activeTab === 'news' ? 'text-brand' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
              @click="activeTab = 'news'"
            >
              {{ t('admin.tenantAdmin.operations.news') }}
              <span
                v-if="activeTab === 'news'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-brand"
              />
            </button>
          </div>

          <!-- Tab content -->
          <div class="mt-4">
            <!-- Incidents -->
            <div v-if="activeTab === 'incidents'" class="space-y-4">
              <!-- Filter buttons -->
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="filter in incidentFilters"
                  :key="filter.key"
                  class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition"
                  :class="incidentFilter === filter.key
                    ? 'bg-brand text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20'"
                  @click="incidentFilter = filter.key"
                >
                  <Icon :icon="filter.icon" class="h-3.5 w-3.5" />
                  {{ filter.label }}
                  <span
                    v-if="filter.count > 0"
                    class="ml-0.5 rounded-full px-1.5 text-[10px]"
                    :class="incidentFilter === filter.key ? 'bg-white/20' : 'bg-slate-200 dark:bg-white/10'"
                  >
                    {{ filter.count }}
                  </span>
                </button>
              </div>

              <!-- Loading -->
              <div v-if="incidentsLoading" class="flex justify-center py-8">
                <Icon icon="mdi:loading" class="h-8 w-8 animate-spin text-brand" />
              </div>

              <!-- Has incidents -->
              <template v-else-if="filteredIncidents.length > 0">
                <div class="space-y-2">
                  <div
                    v-for="incident in paginatedIncidents"
                    :key="incident.id"
                    class="flex items-center justify-between rounded-lg border px-4 py-3"
                    :class="incidentBorderClass(incident.severity)"
                  >
                    <div class="flex items-center gap-3 min-w-0">
                      <Icon :icon="incidentIcon(incident.severity)" class="h-5 w-5 flex-shrink-0" :class="incidentIconClass(incident.severity)" />
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <p class="font-medium text-slate-900 dark:text-slate-100 truncate">{{ incident.title }}</p>
                          <!-- Scheduled badge -->
                          <span
                            v-if="isScheduled(incident)"
                            class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                          >
                            <Icon icon="mdi:calendar-clock" class="h-3 w-3" />
                            {{ t('admin.tenantAdmin.operations.filters.scheduled') }}
                          </span>
                        </div>
                        <p class="text-xs text-slate-500 dark:text-slate-400">
                          <template v-if="isScheduled(incident) && incident.startsAt">
                            {{ t('admin.tenantAdmin.operations.scheduledFor', { date: formatDateTime(incident.startsAt) }) }}
                          </template>
                          <template v-else>
                            {{ formatDate(incident.createdAt) }}
                          </template>
                        </p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <button
                        v-if="incident.status === 'active' && !isScheduled(incident)"
                        class="inline-flex items-center gap-1 rounded-md border border-emerald-600 bg-transparent px-2 py-1 text-xs font-medium text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-500 dark:hover:bg-emerald-500/10"
                        :disabled="resolvingIncidentId === incident.id"
                        @click.prevent="resolveIncident(incident.id)"
                      >
                        <Icon v-if="resolvingIncidentId === incident.id" icon="mdi:loading" class="h-3.5 w-3.5 animate-spin" />
                        <Icon v-else icon="mdi:check-circle" class="h-3.5 w-3.5" />
                        {{ t('admin.tenantAdmin.operations.markResolved') }}
                      </button>
                      <span
                        v-else-if="incident.status === 'resolved'"
                        class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                      >
                        <Icon icon="mdi:check-circle" class="h-3.5 w-3.5" />
                        {{ t('admin.tenantAdmin.operations.resolved') }}
                      </span>
                      <span
                        v-else-if="incident.status === 'active' && !isScheduled(incident)"
                        class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                      >
                        <Icon icon="mdi:circle" class="h-2.5 w-2.5" />
                        {{ t('admin.tenantAdmin.operations.status.active') }}
                      </span>
                      <NuxtLink
                        :to="`/tenant-admin/operations/incidents/${incident.id}`"
                        class="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                        :title="t('admin.tenantAdmin.operations.edit')"
                      >
                        <Icon icon="mdi:pencil" class="h-3.5 w-3.5" />
                      </NuxtLink>
                    </div>
                  </div>
                </div>

                <!-- Pagination -->
                <div v-if="filteredIncidents.length > incidentsPerPage" class="flex items-center justify-between">
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {{ t('admin.tenantAdmin.operations.showing', { count: paginatedIncidents.length, total: filteredIncidents.length }) }}
                  </p>
                  <button
                    class="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                    @click="showAllIncidents = !showAllIncidents"
                  >
                    <Icon :icon="showAllIncidents ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="h-4 w-4" />
                    {{ showAllIncidents ? t('admin.tenantAdmin.operations.showLess') : t('admin.tenantAdmin.operations.showMore') }}
                  </button>
                </div>
              </template>

              <!-- No incidents for filter -->
              <div v-else class="flex flex-col items-center justify-center py-8 text-center">
                <Icon icon="mdi:check-circle-outline" class="h-10 w-10 text-emerald-500" />
                <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  {{ incidentFilter === 'scheduled'
                    ? t('admin.tenantAdmin.operations.noScheduled')
                    : incidentFilter === 'ongoing'
                      ? t('admin.tenantAdmin.operations.noOngoing')
                      : t('admin.tenantAdmin.operations.noIncidents') }}
                </p>
              </div>

              <!-- Action buttons -->
              <div class="flex flex-wrap gap-2">
                <NuxtLink
                  v-if="canCreateIncidents"
                  :to="`/tenant-admin/operations/incidents/new`"
                  class="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand/90"
                >
                  <Icon icon="mdi:plus" class="h-4 w-4" />
                  {{ t('admin.tenantAdmin.operations.createIncident') }}
                </NuxtLink>
                <NuxtLink
                  :to="`/tenant-admin/operations/incidents`"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  <Icon icon="mdi:history" class="h-4 w-4" />
                  {{ t('admin.tenantAdmin.operations.viewHistory') }}
                </NuxtLink>
                <NuxtLink
                  to="/tenant-admin/operations/visibility"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  <Icon icon="mdi:eye-outline" class="h-4 w-4" />
                  {{ t('admin.tenantAdmin.operations.visibility') }}
                </NuxtLink>
              </div>
            </div>

            <!-- News -->
            <div v-if="activeTab === 'news'" class="space-y-4">
              <!-- Loading -->
              <div v-if="newsLoading" class="flex justify-center py-8">
                <Icon icon="mdi:loading" class="h-8 w-8 animate-spin text-brand" />
              </div>

              <!-- Has news -->
              <template v-else-if="newsList.length > 0">
                <div class="space-y-2">
                  <div
                    v-for="post in newsList.slice(0, 5)"
                    :key="post.id"
                    class="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 dark:border-white/10"
                  >
                    <div class="flex items-center gap-3 min-w-0">
                      <div
                        v-if="post.heroImageUrl"
                        class="h-10 w-10 flex-shrink-0 rounded-lg bg-cover bg-center"
                        :style="{ backgroundImage: `url(${post.heroImageUrl})` }"
                      />
                      <Icon v-else icon="mdi:newspaper-variant-outline" class="h-5 w-5 flex-shrink-0 text-slate-400" />
                      <div class="min-w-0">
                        <p class="font-medium text-slate-900 dark:text-slate-100 truncate">{{ post.title }}</p>
                        <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span :class="newsStatusClass(post.status)">{{ t(`admin.tenantAdmin.operations.newsStatus.${post.status}`) }}</span>
                          <span v-if="post.publishedAt">{{ formatDate(post.publishedAt) }}</span>
                        </div>
                      </div>
                    </div>
                    <NuxtLink
                      :to="`/tenant-admin/operations/news/${post.id}`"
                      class="text-xs font-medium text-brand hover:underline flex-shrink-0"
                    >
                      {{ t('admin.tenantAdmin.operations.edit') }}
                    </NuxtLink>
                  </div>
                </div>
              </template>

              <!-- No news -->
              <div v-else class="flex flex-col items-center justify-center py-8 text-center">
                <Icon icon="mdi:newspaper-variant-outline" class="h-10 w-10 text-slate-400" />
                <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  {{ t('admin.tenantAdmin.operations.noNews') }}
                </p>
              </div>

              <!-- Action buttons -->
              <div class="flex flex-wrap gap-2">
                <NuxtLink
                  v-if="canCreateNews"
                  :to="`/tenant-admin/operations/news/new`"
                  class="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand/90"
                >
                  <Icon icon="mdi:plus" class="h-4 w-4" />
                  {{ t('admin.tenantAdmin.operations.createNews') }}
                </NuxtLink>
                <NuxtLink
                  :to="`/tenant-admin/operations/news`"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  <Icon icon="mdi:format-list-bulleted" class="h-4 w-4" />
                  {{ t('admin.tenantAdmin.operations.manageAll') }}
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column (4 cols) -->
      <div class="space-y-6 lg:col-span-4">
        <!-- System Health Card -->
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/70">
          <div class="flex items-center gap-3">
            <Icon icon="mdi:heart-pulse" class="h-6 w-6 text-brand" />
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {{ t('admin.tenantAdmin.health.title') }}
            </h2>
          </div>
          <div class="mt-4 space-y-3">
            <div
              v-for="integration in integrations"
              :key="integration.name"
              class="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-white/5 dark:bg-white/5"
            >
              <div class="flex items-center gap-2">
                <Icon :icon="integration.icon" class="h-4 w-4 text-slate-500" />
                <span class="text-sm text-slate-700 dark:text-slate-300">{{ integration.name }}</span>
              </div>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="getStatusClass(integration.status)"
              >
                {{ integration.status }}
              </span>
            </div>
          </div>
          <p class="mt-4 text-xs text-slate-400 dark:text-slate-500">
            {{ t('admin.tenantAdmin.health.lastSync') }}: —
          </p>
        </div>

        <!-- Recent Activity Card -->
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/70">
          <div class="flex items-center gap-3">
            <Icon icon="mdi:history" class="h-6 w-6 text-brand" />
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {{ t('admin.tenantAdmin.activity.title') }}
            </h2>
          </div>
          <div class="mt-4 flex flex-col items-center justify-center py-6 text-center">
            <Icon icon="mdi:clipboard-text-clock-outline" class="h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {{ t('admin.tenantAdmin.activity.noActivity') }}
            </p>
          </div>
          <NuxtLink
            to="/settings/audit"
            class="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <Icon icon="mdi:file-document-outline" class="h-4 w-4" />
            {{ t('admin.tenantAdmin.activity.viewAuditLog') }}
          </NuxtLink>
        </div>

        <!-- Support Card -->
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/70">
          <div class="flex items-center gap-3">
            <Icon icon="mdi:lifebuoy" class="h-6 w-6 text-brand" />
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {{ t('admin.tenantAdmin.support.title') }}
            </h2>
          </div>
          <div class="mt-4 space-y-2">
            <NuxtLink
              to="/docs"
              class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
            >
              <Icon icon="mdi:book-open-variant" class="h-4 w-4 text-slate-400" />
              {{ t('admin.tenantAdmin.support.documentation') }}
            </NuxtLink>
            <NuxtLink
              to="/support"
              class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
            >
              <Icon icon="mdi:headset" class="h-4 w-4 text-slate-400" />
              {{ t('admin.tenantAdmin.support.contact') }}
            </NuxtLink>
            <a
              href="https://status.coreit.se"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
            >
              <Icon icon="mdi:signal-cellular-3" class="h-4 w-4 text-slate-400" />
              {{ t('admin.tenantAdmin.support.statusPage') }}
              <Icon icon="mdi:open-in-new" class="h-3 w-3 text-slate-300" />
            </a>
          </div>
          <div v-if="isSuperAdmin" class="mt-4 border-t border-slate-100 pt-4 dark:border-white/5">
            <NuxtLink
              to="/platform-admin"
              class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-purple-600 transition hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-500/10"
            >
              <Icon icon="mdi:shield-crown" class="h-4 w-4" />
              {{ t('admin.tenantAdmin.platformAdmin') }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n, useFetch } from '#imports'
import { Icon } from '@iconify/vue'
import { useAuth } from '~/composables/useAuth'
import QuickLinkTile from '~/components/admin/QuickLinkTile.vue'

definePageMeta({
  layout: 'default'
})

const { t } = useI18n()
const auth = useAuth()

const activeTab = ref<'incidents' | 'news'>('incidents')
const resolvingIncidentId = ref<string | null>(null)
const incidentFilter = ref<'all' | 'ongoing' | 'scheduled' | 'resolved'>('all')
const showAllIncidents = ref(false)
const incidentsPerPage = 5

const currentTenant = computed(() => auth.currentTenant.value)
const isDistributor = computed(() => currentTenant.value?.type === 'distributor')
const isProvider = computed(() => currentTenant.value?.type === 'provider')

// --- Operations: Incidents & News ---
interface IncidentItem {
  id: string
  title: string
  severity: 'critical' | 'outage' | 'notice' | 'maintenance' | 'planned'
  status: 'active' | 'resolved'
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  deletedAt: string | null
}

interface NewsItem {
  id: string
  title: string
  slug: string
  status: 'draft' | 'published' | 'archived'
  heroImageUrl: string | null
  publishedAt: string | null
  createdAt: string
}

interface IncidentsResponse {
  incidents: IncidentItem[]
  tenantType: string
}

interface NewsResponse {
  posts: NewsItem[]
  tenantType: string
}

// Get tenant ID for fetch operations
const tenantId = computed(() => currentTenant.value?.id)

// Fetch incidents for current tenant
const { data: incidentsData, pending: incidentsLoading, refresh: refreshIncidents } = (useFetch as any)(
  () => `/api/admin/tenants/${tenantId.value}/incidents?filter=all`,
  {
    key: `tenant-incidents-${tenantId.value}`,
    watch: [tenantId],
    default: () => ({ incidents: [], tenantType: '' }),
    server: false,
    lazy: true,
    immediate: !!tenantId.value
  }
)

// Fetch news for current tenant
const { data: newsData, pending: newsLoading, refresh: refreshNews } = (useFetch as any)(
  () => `/api/admin/tenants/${tenantId.value}/news?status=all&limit=10`,
  {
    key: `tenant-news-${tenantId.value}`,
    watch: [tenantId],
    default: () => ({ posts: [], tenantType: '' }),
    server: false,
    lazy: true,
    immediate: !!tenantId.value
  }
)

// Trigger fetch when tenantId becomes available
watch(tenantId, (newTenantId) => {
  if (newTenantId) {
    refreshIncidents()
    refreshNews()
  }
}, { immediate: true })

const incidentsList = computed(() => incidentsData.value?.incidents ?? [])
const newsList = computed(() => newsData.value?.posts ?? [])

const canCreateIncidents = computed(() => {
  const tenant = currentTenant.value
  if (!tenant) return false
  return tenant.type === 'distributor' || tenant.type === 'provider'
})

const canCreateNews = computed(() => canCreateIncidents.value)

// Helper to check if an incident is scheduled for the future
function isScheduled(incident: IncidentItem): boolean {
  if (!incident.startsAt || incident.status === 'resolved') return false
  const now = new Date()
  const startsAt = new Date(incident.startsAt)
  return startsAt > now
}

// Helper to check if an incident is currently ongoing
function isOngoing(incident: IncidentItem): boolean {
  if (incident.status === 'resolved') return false
  if (!incident.startsAt) return incident.status === 'active'
  const now = new Date()
  const startsAt = new Date(incident.startsAt)
  return startsAt <= now && incident.status === 'active'
}

// Categorized incident counts
const ongoingCount = computed(() => incidentsList.value.filter(isOngoing).length)
const scheduledCount = computed(() => incidentsList.value.filter(isScheduled).length)
const resolvedCount = computed(() => incidentsList.value.filter((i: any) => i.status === 'resolved').length)

// Filter options with counts
const incidentFilters = computed(() => [
  { key: 'all' as const, label: t('admin.tenantAdmin.operations.filters.all'), icon: 'mdi:format-list-bulleted', count: incidentsList.value.length },
  { key: 'ongoing' as const, label: t('admin.tenantAdmin.operations.filters.ongoing'), icon: 'mdi:circle', count: ongoingCount.value },
  { key: 'scheduled' as const, label: t('admin.tenantAdmin.operations.filters.scheduled'), icon: 'mdi:calendar-clock', count: scheduledCount.value },
  { key: 'resolved' as const, label: t('admin.tenantAdmin.operations.filters.resolved'), icon: 'mdi:check-circle', count: resolvedCount.value }
])

// Filtered incidents based on selected filter
const filteredIncidents = computed(() => {
  const incidents = incidentsList.value
  switch (incidentFilter.value) {
    case 'ongoing':
      return incidents.filter(isOngoing)
    case 'scheduled':
      return incidents.filter(isScheduled)
    case 'resolved':
      return incidents.filter((i: any) => i.status === 'resolved')
    default:
      return incidents
  }
})

// Paginated incidents
const paginatedIncidents = computed(() => {
  if (showAllIncidents.value) {
    return filteredIncidents.value
  }
  return filteredIncidents.value.slice(0, incidentsPerPage)
})

// Reset pagination when filter changes
watch(incidentFilter, () => {
  showAllIncidents.value = false
})

async function resolveIncident(incidentId: string) {
  if (!tenantId.value || resolvingIncidentId.value) return
  
  resolvingIncidentId.value = incidentId
  try {
    await ($fetch as any)(`/api/admin/tenants/${tenantId.value}/incidents/${incidentId}/resolve`, {
      method: 'POST',
      credentials: 'include'
    })
    await refreshIncidents()
  } catch (err) {
    console.error('Failed to resolve incident:', err)
  } finally {
    resolvingIncidentId.value = null
  }
}

function incidentIcon(severity: string): string {
  switch (severity) {
    case 'critical': return 'mdi:alert-circle'
    case 'outage': return 'mdi:alert'
    case 'maintenance': return 'mdi:wrench'
    case 'planned': return 'mdi:calendar-clock'
    default: return 'mdi:information'
  }
}

function incidentIconClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-500'
    case 'outage': return 'text-orange-500'
    case 'maintenance':
    case 'planned': return 'text-blue-500'
    default: return 'text-amber-500'
  }
}

function incidentBorderClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'border-red-200 bg-red-50/50 dark:border-red-500/30 dark:bg-red-500/5'
    case 'outage': return 'border-orange-200 bg-orange-50/50 dark:border-orange-500/30 dark:bg-orange-500/5'
    case 'maintenance':
    case 'planned': return 'border-blue-200 bg-blue-50/50 dark:border-blue-500/30 dark:bg-blue-500/5'
    default: return 'border-slate-200 dark:border-white/10'
  }
}

function newsStatusClass(status: string): string {
  switch (status) {
    case 'published': return 'text-emerald-600 dark:text-emerald-400'
    case 'draft': return 'text-amber-600 dark:text-amber-400'
    case 'archived': return 'text-slate-500 dark:text-slate-400'
    default: return ''
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('sv-SE', { dateStyle: 'short' })
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('sv-SE', { dateStyle: 'short' }) + ' ' + date.toLocaleTimeString('sv-SE', { timeStyle: 'short' })
}
const isSuperAdmin = computed(() => auth.isSuperAdmin.value)

interface MembersResponse {
  members: { membershipId: string }[]
  invites: { id: string }[]
}

interface ModuleStatusDto {
  key: string
  tenantEnabled: boolean
  effectiveEnabled: boolean
  effectiveDisabled?: boolean
}

interface ModulesResponse {
  modules: ModuleStatusDto[]
}

const { data: membersData } = (useFetch as any)(
  () => tenantId.value ? `/api/admin/tenants/${tenantId.value}/members` : '',
  {
    immediate: !!tenantId.value,
    watch: [tenantId],
    default: () => ({ members: [], invites: [] })
  }
)

// Fetch module status for active modules count
const { data: modulesData } = (useFetch as any)(
  () => tenantId.value ? `/api/admin/tenants/${tenantId.value}/modules` : '',
  {
    immediate: !!tenantId.value,
    watch: [tenantId],
    default: () => ({ modules: [] })
  }
)

// Fetch organizations for current tenant (not from auth state, which only shows user's memberships)
interface OrganizationsResponse {
  organizations: { id: string; name: string; slug: string }[]
}

const { data: organizationsData } = (useFetch as any)(
  () => tenantId.value ? `/api/admin/tenants/${tenantId.value}/organizations` : '',
  {
    immediate: !!tenantId.value,
    watch: [tenantId],
    default: () => ({ organizations: [] })
  }
)

interface ProvidersResponseItem {
  id: string
  name: string
  slug: string
  type: string
  status: string
}

const { data: providersData, refresh: refreshProviders } = (useFetch as any)(
  () => `/api/admin/tenants/${tenantId.value}/providers`,
  {
    immediate: false,
    default: () => []
  }
)

watch([tenantId, isDistributor], ([newTenantId, distributor]) => {
  if (newTenantId && distributor) {
    refreshProviders()
  }
}, { immediate: true })

const organizationCount = computed(() => {
  return organizationsData.value?.organizations?.length ?? 0
})

const providerCount = computed(() => {
  return providersData.value?.length ?? 0
})

const overviewPrimaryCount = computed(() => {
  return isDistributor.value ? providerCount.value : organizationCount.value
})

const overviewPrimaryLabel = computed(() => {
  return isDistributor.value
    ? t('admin.tenantAdmin.overview.providers')
    : t('admin.tenantAdmin.overview.organizations')
})

const memberCount = computed(() => {
  return membersData.value?.members?.length ?? null
})

const activeModulesCount = computed(() => {
  if (!modulesData.value?.modules) return null
  // Count modules that are enabled at tenant level (tenantEnabled) and not disabled
  return modulesData.value.modules.filter((m: any) => m.tenantEnabled && !m.effectiveDisabled).length
})

const tenantTypeIcon = computed(() => {
  switch (currentTenant.value?.type) {
    case 'distributor':
      return 'mdi:city'
    case 'provider':
      return 'mdi:store'
    default:
      return 'mdi:office-building-outline'
  }
})

const tenantTypeColor = computed(() => {
  switch (currentTenant.value?.type) {
    case 'distributor':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    case 'provider':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
    default:
      return 'bg-brand/10 text-brand'
  }
})

const canCreateProvider = computed(() => {
  if (!currentTenant.value) return false
  if (isSuperAdmin.value) return true
  if (currentTenant.value.type !== 'distributor') return false
  const role = auth.state.value.data?.tenantRoles[currentTenant.value.id]
  const includeChildren = auth.state.value.data?.tenantIncludeChildren?.[currentTenant.value.id] ?? false
  return role === 'admin' && includeChildren
})

const tenantActions = computed(() => {
  const tenant = currentTenant.value
  if (!tenant) return []

  const actions = []
  const tenantId = tenant.id
  const isProvider = tenant.type === 'provider'
  const isDistributor = tenant.type === 'distributor'

  // Create provider (distributor only)
  if (isDistributor && canCreateProvider.value) {
    actions.push({
      to: `/tenant-admin/tenants/${tenantId}/providers/new`,
      icon: 'mdi:store-plus',
      label: t('admin.tenantAdmin.tenantActions.createProvider'),
      description: t('admin.tenantAdmin.tenantActions.createProviderDesc'),
      disabled: false
    })
  }

  // Create organization (provider only)
  if (isProvider) {
    actions.push({
      to: `/tenant-admin/organizations/new?tenantId=${tenantId}`,
      icon: 'mdi:home-plus',
      label: t('admin.tenantAdmin.tenantActions.createOrg'),
      description: t('admin.tenantAdmin.tenantActions.createOrgDesc'),
      disabled: false
    })
  }

  // Members
  actions.push({
    to: `/tenant-admin/tenants/${tenantId}/members`,
    icon: 'mdi:account-group',
    label: t('admin.tenantAdmin.tenantActions.members'),
    description: t('admin.tenantAdmin.tenantActions.membersDesc'),
    disabled: false
  })

  // Email settings
  actions.push({
    to: `/tenant-admin/tenants/${tenantId}/email`,
    icon: 'mdi:email-outline',
    label: t('admin.tenantAdmin.tenantActions.email'),
    description: t('admin.tenantAdmin.tenantActions.emailDesc'),
    disabled: false
  })

  // Module permissions
  actions.push({
    to: `/tenant-admin/tenants/${tenantId}/modules`,
    icon: 'mdi:puzzle-outline',
    label: t('admin.tenantAdmin.tenantActions.modules'),
    description: t('admin.tenantAdmin.tenantActions.modulesDesc'),
    disabled: false
  })

  // MSP roles (provider only)
  if (isProvider) {
    actions.push({
      to: `/tenant-admin/tenants/${tenantId}/msp-roles`,
      icon: 'mdi:shield-account',
      label: t('admin.tenantAdmin.tenantActions.mspRoles'),
      description: t('admin.tenantAdmin.tenantActions.mspRolesDesc'),
      disabled: false
    })
  }

  // Role templates (distributor only)
  if (isDistributor) {
    actions.push({
      to: `/tenant-admin/distributors/${tenantId}/msp-role-templates`,
      icon: 'mdi:file-document-multiple-outline',
      label: t('admin.tenantAdmin.tenantActions.roleTemplates'),
      description: t('admin.tenantAdmin.tenantActions.roleTemplatesDesc'),
      disabled: false
    })
  }

  // Custom Domain
  actions.push({
    to: `/tenant-admin/tenants/${tenantId}/domain`,
    icon: 'mdi:web',
    label: t('admin.tenantAdmin.tenantActions.customDomain'),
    description: t('admin.tenantAdmin.tenantActions.customDomainDesc'),
    disabled: false
  })

  // Branding
  actions.push({
    to: `/tenant-admin/tenants/${tenantId}/branding`,
    icon: 'mdi:palette-outline',
    label: t('admin.tenantAdmin.tenantActions.branding'),
    description: t('admin.tenantAdmin.tenantActions.brandingDesc'),
    disabled: false
  })

  // Audit logs
  actions.push({
    to: `/tenant-admin/tenants/${tenantId}/audit-logs`,
    icon: 'mdi:file-document-outline',
    label: t('admin.tenantAdmin.tenantActions.auditLogs'),
    description: t('admin.tenantAdmin.tenantActions.auditLogsDesc'),
    disabled: false
  })

  return actions
})

const integrations = [
  { name: 'Cloudflare DNS', icon: 'mdi:shield-check', status: 'Unknown' },
  { name: 'Windows DNS', icon: 'mdi:dns', status: 'Unknown' },
  { name: 'RMM', icon: 'mdi:remote-desktop', status: 'Unknown' }
]

function getStatusClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'connected':
    case 'ok':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
    case 'error':
    case 'failed':
      return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
    case 'degraded':
    case 'warning':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400'
  }
}
</script>

