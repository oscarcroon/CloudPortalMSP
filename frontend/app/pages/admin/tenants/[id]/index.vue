<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <NuxtLink
        to="/admin/tenants"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        ← Tillbaka till listan
      </NuxtLink>
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">{{ tenant?.name ?? 'Laddar...' }}</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          <span v-if="tenant?.type === 'distributor'">Distributör - kan skapa leverantörer</span>
          <span v-else-if="tenant?.type === 'provider'">Leverantör - kan skapa organisationer</span>
          <span v-else-if="tenant?.type === 'organization'">Organisation</span>
        </p>
      </div>
    </header>

    <div v-if="error" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      {{ error }}
    </div>

    <div v-if="memberError" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      {{ memberError }}
    </div>

    <div v-if="pending" class="text-sm text-slate-600 dark:text-slate-400">Laddar tenant-detaljer...</div>

    <div v-else-if="tenant" class="space-y-6">
      <!-- Tenant Information -->
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Information</h2>
          <button
            v-if="canEdit && (tenant.type === 'provider' || tenant.type === 'distributor')"
            class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            @click="isEditing = !isEditing"
          >
            <Icon :icon="isEditing ? 'mdi:close' : 'mdi:pencil-outline'" class="h-3 w-3" />
            {{ isEditing ? 'Avbryt' : 'Redigera' }}
          </button>
        </div>
        
        <div v-if="updateError" class="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {{ updateError }}
        </div>

        <div v-if="!isEditing" class="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Namn</p>
            <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{{ tenant.name }}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Slug</p>
            <p class="mt-1 font-mono text-sm text-slate-700 dark:text-slate-300">{{ tenant.slug }}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Typ</p>
            <span
              class="mt-1 inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold"
              :class="getTypeClass(tenant.type)"
            >
              {{ getTypeLabel(tenant.type) }}
            </span>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</p>
            <StatusPill :variant="tenant.status === 'active' ? 'success' : 'warning'" class="mt-1">
              {{ tenant.status }}
            </StatusPill>
          </div>
        </div>

        <form v-else @submit.prevent="handleSave" class="mt-4 space-y-4">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label for="name" class="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Namn
              </label>
              <input
                id="name"
                v-model="editForm.name"
                type="text"
                required
                minlength="2"
                maxlength="120"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              />
            </div>
            <div>
              <label for="slug" class="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Slug
              </label>
              <input
                id="slug"
                v-model="editForm.slug"
                type="text"
                required
                minlength="2"
                maxlength="120"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              />
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Endast små bokstäver, siffror och bindestreck
              </p>
            </div>
          </div>
          <div class="flex gap-2">
            <button
              type="submit"
              :disabled="saving"
              class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              <Icon v-if="saving" icon="mdi:loading" class="h-4 w-4 animate-spin" />
              <span v-else>Spara</span>
            </button>
            <button
              type="button"
              @click="cancelEdit"
              class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              Avbryt
            </button>
          </div>
        </form>
      </div>

      <!-- Actions -->
      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-if="tenant.type === 'distributor' && canCreateProvider"
          :to="`/admin/tenants/${tenant.id}/providers/new`"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Icon icon="mdi:store" class="h-4 w-4" />
          Skapa leverantör
        </NuxtLink>
        <NuxtLink
          v-if="tenant.type === 'provider' && canCreateOrganization"
          :to="`/admin/organizations/new?tenantId=${tenant.id}`"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80"
        >
          <Icon icon="mdi:home" class="h-4 w-4" />
          Skapa organisation
        </NuxtLink>
        <NuxtLink
          v-if="tenant.type === 'provider' || tenant.type === 'distributor'"
          :to="`/admin/tenants/${tenant.id}/email`"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <Icon icon="mdi:email-outline" class="h-4 w-4" />
          E-postinställningar
        </NuxtLink>
        <NuxtLink
          v-if="tenant.type === 'provider' || tenant.type === 'distributor'"
          :to="`/admin/tenants/${tenant.id}/modules`"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <Icon icon="mdi:puzzle-outline" class="h-4 w-4" />
          Modulrättigheter
        </NuxtLink>
        <NuxtLink
          v-if="tenant.type === 'provider' || tenant.type === 'distributor'"
          :to="`/admin/tenants/${tenant.id}/branding`"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <Icon icon="mdi:palette-outline" class="h-4 w-4" />
          Branding
        </NuxtLink>
        <NuxtLink
          v-if="(tenant.type === 'provider' || tenant.type === 'distributor') && canReadAuditLogs"
          :to="`/admin/tenants/${tenant.id}/audit-logs`"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <Icon icon="mdi:file-document-outline" class="h-4 w-4" />
          Audit Loggar
        </NuxtLink>
      </div>

      <!-- Linked Tenants (Providers for Distributors, Distributors for Providers) -->
      <div v-if="tenant.type === 'distributor' || tenant.type === 'provider'" class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div
              v-if="tenant.type === 'provider'"
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
            >
              <Icon icon="mdi:city" class="h-5 w-5" />
            </div>
            <div
              v-else-if="tenant.type === 'distributor'"
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            >
              <Icon icon="mdi:store" class="h-5 w-5" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
                <span v-if="tenant.type === 'distributor'">Leverantörer</span>
                <span v-else-if="tenant.type === 'provider'">Distributörer</span>
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                <span v-if="tenant.type === 'distributor'">{{ linkedTenants.length }} leverantörer</span>
                <span v-else-if="tenant.type === 'provider'">{{ linkedTenants.length }} distributörer</span>
              </p>
            </div>
          </div>
          <button
            v-if="tenant.type === 'provider' && canEditTenant"
            class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            @click="openEditDistributorsModal"
          >
            <Icon icon="mdi:pencil-outline" class="h-3 w-3" />
            Redigera
          </button>
        </div>
        <div v-if="linkedTenants.length === 0" class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
          <span v-if="tenant.type === 'provider'">Inga distributörer kopplade.</span>
          <span v-else>Inga leverantörer kopplade.</span>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5">
            <thead class="bg-slate-50 dark:bg-white/5">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Namn</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Slug</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">E-post</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-white/5">
              <tr
                v-for="linked in linkedTenants"
                :key="linked.id"
                class="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-white/5"
                @click="navigateToTenant(linked.id)"
              >
                <td class="px-6 py-3 font-semibold text-slate-900 dark:text-white">{{ linked.name }}</td>
                <td class="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{{ linked.slug }}</td>
                <td class="px-6 py-3">
                  <span
                    v-if="linked.hasEmailOverride"
                    class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    title="E-post override aktiv"
                  >
                    <Icon icon="mdi:email-check" class="h-3 w-3" />
                    Override
                  </span>
                  <span v-else class="text-xs text-slate-400 dark:text-slate-500">Ärvs</span>
                </td>
                <td class="px-6 py-3">
                  <StatusPill :variant="linked.status === 'active' ? 'success' : 'warning'">
                    {{ linked.status }}
                  </StatusPill>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Organizations (for Providers) -->
      <div v-if="tenant.type === 'provider' && organizations.length > 0" class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              <Icon icon="mdi:home" class="h-5 w-5" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Organisationer</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ organizations.length }} organisationer</p>
            </div>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5">
            <thead class="bg-slate-50 dark:bg-white/5">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Namn</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Slug</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">E-post</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-white/5">
              <tr
                v-for="org in organizations"
                :key="org.id"
                class="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-white/5"
                @click="navigateToOrg(org.slug)"
              >
                <td class="px-6 py-3 font-semibold text-slate-900 dark:text-white">{{ org.name }}</td>
                <td class="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{{ org.slug }}</td>
                <td class="px-6 py-3">
                  <span
                    v-if="org.hasEmailOverride"
                    class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    title="E-post override aktiv"
                  >
                    <Icon icon="mdi:email-check" class="h-3 w-3" />
                    Override
                  </span>
                  <span v-else class="text-xs text-slate-400 dark:text-slate-500">Ärvs</span>
                </td>
                <td class="px-6 py-3">
                  <StatusPill :variant="org.status === 'active' ? 'success' : 'warning'">
                    {{ org.status }}
                  </StatusPill>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Members -->
      <div class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <Icon icon="mdi:account-group" class="h-5 w-5" />
              </div>
              <div>
                <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Medlemmar</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {{ members.length }} medlemmar med {{ tenant.type === 'distributor' ? 'distributörs' : tenant.type === 'provider' ? 'leverantörs' : 'organisations' }}rättigheter
                </p>
              </div>
            </div>
            <button
              v-if="canInviteMember"
              class="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90"
              @click="openInviteModal"
            >
              <Icon icon="mdi:account-plus-outline" class="h-4 w-4" />
              Bjud in medlem
            </button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5">
            <thead class="bg-slate-50 dark:bg-white/5">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Användare</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Roll</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
                <th v-if="canInviteMember" class="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Åtgärder</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-white/5">
              <tr v-for="member in members" :key="member.id" class="text-slate-900 dark:text-white">
                <td class="px-6 py-3">
                  <div class="font-semibold">{{ member.user.email }}</div>
                  <p v-if="member.user.fullName" class="text-xs text-slate-500 dark:text-slate-400">
                    {{ member.user.fullName }}
                  </p>
                </td>
                <td class="px-6 py-3">
                  <select
                    :key="`role-select-${member.id}-${member.role}`"
                    :disabled="
                      member.status !== 'active' ||
                      roleLoadingId === member.id ||
                      statusLoadingId === member.id ||
                      removalLoadingId === member.id ||
                      !canManageMembers
                    "
                    class="rounded border border-slate-200 bg-transparent px-2 py-1 text-sm dark:border-white/10"
                    :value="String(member.role || '')"
                    @change="handleRoleChange(member, ($event.target as HTMLSelectElement).value)"
                  >
                    <option
                      v-for="role in tenantRoles"
                      :key="role"
                      :value="role"
                      :disabled="
                        member.role === 'admin' &&
                        role !== 'admin' &&
                        member.userId === auth.user.value?.id
                      "
                    >
                      {{ role }}
                    </option>
                  </select>
                </td>
                <td class="px-6 py-3">
                  <StatusPill :variant="member.status === 'active' ? 'success' : 'warning'">
                    {{ member.status }}
                  </StatusPill>
                </td>
                <td v-if="canInviteMember" class="px-6 py-3 text-right">
                  <div class="flex flex-wrap justify-end gap-2 text-xs">
                    <button
                      v-if="member.status === 'active'"
                      class="rounded border border-amber-200 px-3 py-1 text-amber-700 transition hover:border-amber-300 hover:text-amber-600 disabled:opacity-40 dark:border-amber-500/30 dark:text-amber-200"
                      :disabled="statusLoadingId === member.id || removalLoadingId === member.id"
                      @click="disableMember(member)"
                    >
                      {{ statusLoadingId === member.id ? 'Inaktiverar...' : 'Inaktivera' }}
                    </button>
                    <button
                      v-if="member.status === 'suspended'"
                      class="rounded border border-emerald-200 px-3 py-1 text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-40 dark:border-emerald-500/30 dark:text-emerald-200"
                      :disabled="statusLoadingId === member.id || removalLoadingId === member.id"
                      @click="enableMember(member)"
                    >
                      {{ statusLoadingId === member.id ? 'Aktiverar...' : 'Aktivera' }}
                    </button>
                    <button
                      class="rounded border border-red-200 px-3 py-1 font-semibold text-red-600 transition hover:border-red-300 hover:text-red-500 disabled:opacity-40 dark:border-red-500/30 dark:text-red-200"
                      :disabled="removalLoadingId === member.id || statusLoadingId === member.id"
                      @click="removeMember(member)"
                    >
                      {{ removalLoadingId === member.id ? 'Tar bort...' : 'Ta bort permanent' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="memberError" class="border-t border-slate-200 px-6 py-3 dark:border-white/5">
          <div class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {{ memberError }}
          </div>
        </div>
      </div>

      <!-- Pending Invitations -->
      <div v-if="tenant.type === 'provider' || tenant.type === 'distributor'" class="rounded-xl border border-dashed border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <p class="text-sm font-semibold text-slate-900 dark:text-white">Väntande inbjudningar</p>
        </div>
        <div v-if="!invites.length" class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
          Inga aktiva inbjudningar.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5">
            <thead class="bg-slate-50 dark:bg-white/5">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">E-post</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Roll</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Bjuden av</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Gäller till</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Organisation</th>
                <th v-if="canInviteMember" class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 text-right">Åtgärder</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-white/5">
              <tr v-for="invite in invites" :key="invite.id">
                <td class="px-6 py-3 text-slate-700 dark:text-slate-200">{{ invite.email }}</td>
                <td class="px-6 py-3">{{ invite.role }}</td>
                <td class="px-6 py-3">
                  <StatusPill :variant="invite.status === 'pending' ? 'warning' : invite.status === 'accepted' ? 'success' : 'info'">
                    {{ invitationStatusLabel(invite.status) }}
                  </StatusPill>
                </td>
                <td class="px-6 py-3 text-sm text-slate-600 dark:text-slate-300">
                  {{ invite.invitedBy?.email ?? '–' }}
                </td>
                <td class="px-6 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {{ formatDate(invite.expiresAt) }}
                </td>
                <td class="px-6 py-3 text-xs text-slate-600 dark:text-slate-400">
                  <span v-if="invite.willCreateOrganization && invite.organizationName" class="font-semibold">
                    Kommer skapa: {{ invite.organizationName }}
                  </span>
                  <span v-else class="text-slate-400 dark:text-slate-500">—</span>
                </td>
                <td v-if="canInviteMember" class="px-6 py-3 text-right">
                  <button
                    v-if="invite.status === 'pending'"
                    class="rounded border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:text-red-500 disabled:opacity-40 dark:border-red-500/30 dark:text-red-200"
                    :disabled="inviteCancelLoadingId === invite.id"
                    @click="cancelInvite(invite.id)"
                  >
                    {{ inviteCancelLoadingId === invite.id ? 'Avbryter...' : 'Avbryt' }}
                  </button>
                  <span v-else class="text-xs text-slate-400 dark:text-slate-500">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Danger Zone (for distributors only) -->
      <section
        v-if="tenant.type === 'distributor' && auth.isSuperAdmin.value"
        class="rounded-xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-500/40 dark:bg-[#1a0f14]"
      >
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-red-700 dark:text-red-200">Danger zone</h2>
            <p class="text-sm text-red-600 dark:text-red-300">
              Radering tar bort distributören och all kopplad data. Distributören kan endast raderas om alla organisationer kopplade via leverantörer först är borttagna. Detta kan inte ångras.
            </p>
          </div>
          <button
            class="rounded-lg border border-red-400 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500 dark:text-red-200 dark:hover:bg-red-500/10"
            :disabled="!tenant"
            @click="openDeleteModal"
          >
            Ta bort distributör
          </button>
        </div>
      </section>
    </div>

    <!-- Edit Distributors Modal -->
    <Modal :show="showEditDistributorsModal" @close="closeEditDistributorsModal">
      <template #title>Redigera distributör-kopplingar</template>
      <template #content>
        <form @submit.prevent="handleSaveDistributors" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-200">Distributörer</label>
            <div class="mt-2 space-y-2 max-h-60 overflow-y-auto">
              <label
                v-for="distributor in allDistributors"
                :key="distributor.id"
                class="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  :value="distributor.id"
                  v-model="editDistributorsForm.distributorIds"
                  class="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand dark:border-white/10 dark:bg-black/20"
                />
                <span class="text-sm text-slate-900 dark:text-white">
                  {{ distributor.name }} ({{ distributor.slug }})
                </span>
              </label>
              <p v-if="allDistributors.length === 0" class="text-sm text-slate-500 dark:text-slate-400">
                Inga distributörer tillgängliga.
              </p>
            </div>
            <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Välj vilka distributörer denna leverantör ska kopplas till.
            </p>
          </div>
          <div v-if="editDistributorsError" class="text-sm text-red-500">{{ editDistributorsError }}</div>
          <div class="flex justify-end gap-3">
            <button
              type="button"
              class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
              @click="closeEditDistributorsModal"
            >
              Avbryt
            </button>
            <button
              type="submit"
              class="inline-flex justify-center rounded-md border border-transparent bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand/80 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
              :disabled="savingDistributors"
            >
              <Icon v-if="savingDistributors" icon="mdi:loading" class="h-5 w-5 animate-spin" />
              <span v-else>Spara</span>
            </button>
          </div>
        </form>
      </template>
    </Modal>

    <!-- Invite Member Modal -->
    <div
      v-if="showInviteModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 overflow-y-auto"
      @click.self="closeInviteModal"
    >
      <form
        class="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0f172a]"
        @submit.prevent="submitInvite"
      >
        <div class="flex-1 overflow-y-auto p-6 space-y-4">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Bjud in medlem</h3>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          Bjud in en användare att bli medlem i {{ tenant?.type === 'distributor' ? 'distributören' : 'leverantören' }} med rättigheter.
        </p>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">E-post</label>
          <input
            v-model="inviteForm.email"
            type="email"
            required
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            placeholder="namn@example.com"
            @blur="checkUserExists"
          />
          <p v-if="checkingUser" class="mt-1 text-xs text-slate-500 dark:text-slate-400">Kontrollerar...</p>
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Roll</label>
          <select
            v-model="inviteForm.role"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          >
            <option value="viewer">Viewer</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="support">Support</option>
          </select>
        </div>
        <label
          v-if="tenant?.type === 'distributor' && userExists"
          class="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300"
        >
          <input
            v-model="inviteForm.includeChildren"
            type="checkbox"
            class="mt-1 rounded border-slate-300 dark:border-white/20"
          />
          <span>
            Inkludera underordnade
            <span class="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              Ge åtkomst till alla leverantörer under denna distributör.
            </span>
          </span>
        </label>
        <label
          class="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm transition"
          :class="userExists 
            ? 'border-slate-200 bg-slate-50 text-slate-400 dark:border-white/5 dark:bg-white/5 dark:text-slate-500' 
            : 'text-slate-600 dark:border-white/10 dark:text-slate-300'"
        >
          <input
            v-model="inviteForm.createOrganization"
            type="checkbox"
            :disabled="userExists"
            class="mt-1 rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20"
          />
          <span>
            Skapa organisation åt användaren
            <span v-if="!userExists" class="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              Organisationen skapas när inbjudan accepteras.
            </span>
            <span v-else class="mt-0.5 block text-xs text-slate-400 dark:text-slate-500">
              Användaren finns redan i systemet. Skapa organisation separat efter att medlemmen har lagts till.
            </span>
          </span>
        </label>
        <div v-if="!userExists && inviteForm.createOrganization" class="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
          <h4 class="text-sm font-semibold text-slate-900 dark:text-white">Organisationsdetaljer</h4>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Namn *</label>
            <input
              v-model="inviteForm.organization.name"
              type="text"
              required
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Slug</label>
            <input
              v-model="inviteForm.organization.slug"
              type="text"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Lämna tomt för att generera automatiskt från namn
            </p>
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">COREID *</label>
            <input
              v-model="inviteForm.organization.coreId"
              type="text"
              required
              maxlength="4"
              pattern="[A-Z0-9]{4}"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm uppercase text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Exakt 4 tecken, endast bokstäver och siffror</p>
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Fakturerings-e-post</label>
            <input
              v-model="inviteForm.organization.billingEmail"
              type="email"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>
        </div>
        </div>
        <div class="border-t border-slate-200 p-6 dark:border-white/10">
          <div v-if="inviteError" class="mb-4 rounded bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
            {{ inviteError }}
          </div>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 dark:border-white/10 dark:text-slate-200"
              @click="closeInviteModal"
            >
              Avbryt
            </button>
            <button
              type="submit"
              class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80 disabled:opacity-60"
              :disabled="inviteLoading"
            >
              {{ inviteLoading ? 'Skickar...' : 'Skicka inbjudan' }}
            </button>
          </div>
        </div>
      </form>
    </div>

    <!-- Delete Distributor Modal -->
    <div
      v-if="showDeleteModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
      @click.self="closeDeleteModal"
    >
      <form
        class="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0f172a]"
        @submit.prevent="submitDelete"
      >
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Ta bort distributör</h3>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          Bekräfta åtgärden genom att skriva in distributörens slug (<strong>{{ tenant?.slug }}</strong>) och markera att du förstår konsekvenserna. Distributören kan endast raderas om alla organisationer kopplade via leverantörer först är borttagna.
        </p>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Bekräfta slug</label>
          <input
            v-model="deleteForm.confirmSlug"
            type="text"
            required
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-white/10 dark:bg-black/20 dark:text-white"
            :placeholder="tenant?.slug ?? ''"
          />
        </div>
        <label class="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700 dark:border-white/10 dark:text-slate-200">
          <input v-model="deleteForm.acknowledgeImpact" type="checkbox" class="mt-1 rounded border-slate-300 dark:border-white/20" />
          <span>Jag förstår att distributören och all kopplad data (leverantörs-kopplingar, medlemskap m.m.) raderas permanent. Distributören kan endast raderas om alla organisationer kopplade via leverantörer först är borttagna.</span>
        </label>
        <div v-if="deleteError" class="rounded bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300 whitespace-pre-line">
          {{ deleteError }}
        </div>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 dark:border-white/10 dark:text-slate-200"
            @click="closeDeleteModal"
          >
            Avbryt
          </button>
          <button
            type="submit"
            class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
            :disabled="deleteDisabled || deleteLoading"
          >
            {{ deleteLoading ? 'Raderar...' : 'Ta bort permanent' }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, useFetch, useRoute, useRouter, watch } from '#imports'
import { Icon } from '@iconify/vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import Modal from '~/components/shared/Modal.vue'
import type { AdminTenantDetail, AdminTenantSummary } from '~/types/admin'
import { useAuth } from '~/composables/useAuth'
import { tenantRoles, tenantRolePermissionMap } from '~/constants/rbac'
import type { TenantRole } from '~/constants/rbac'

definePageMeta({
  layout: 'default'
})

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const tenantId = route.params.id as string

const { data, pending, error, refresh } = await useFetch<AdminTenantDetail>(`/api/admin/tenants/${tenantId}`)

const tenant = computed(() => data.value?.tenant)
const members = computed(() => {
  const mems = data.value?.members ?? []
  if (import.meta.dev && import.meta.client) {
    const serialized = mems.map(m => ({
      id: m.id,
      userId: m.userId,
      email: m.user?.email,
      fullName: m.user?.fullName,
      role: m.role,
      roleType: typeof m.role,
      roleValue: String(m.role),
      status: m.status
    }))
    console.log('[Tenant Members] Raw members data:', serialized)
    console.log('[Tenant Members] Full data.value:', JSON.parse(JSON.stringify(data.value)))
  }
  return mems
})
const childTenants = computed(() => data.value?.childTenants ?? [])
const linkedTenants = computed(() => data.value?.linkedTenants ?? [])
const organizations = computed(() => data.value?.organizations ?? [])
const invites = computed(() => data.value?.invites ?? [])

const isEditing = ref(false)
const saving = ref(false)
const updateError = ref('')
const editForm = ref({
  name: '',
  slug: ''
})

// Delete distributor state
const showDeleteModal = ref(false)
const deleteLoading = ref(false)
const deleteError = ref('')
const deleteForm = reactive({
  confirmSlug: '',
  acknowledgeImpact: false
})

// Invite member state
const showInviteModal = ref(false)
const inviteLoading = ref(false)
const inviteError = ref('')
const userExists = ref(false)
const checkingUser = ref(false)
const inviteForm = reactive({
  email: '',
  role: 'viewer' as 'admin' | 'user' | 'viewer' | 'support',
  includeChildren: false,
  createOrganization: false,
  organization: {
    name: '',
    slug: '',
    billingEmail: '',
    coreId: ''
  }
})

// Member management state
const statusLoadingId = ref<string>('')
const removalLoadingId = ref<string>('')
const roleLoadingId = ref<string | null>(null)
const memberError = ref('')
const inviteCancelLoadingId = ref<string>('')

watch(tenant, (t) => {
  if (t) {
    editForm.value.name = t.name
    editForm.value.slug = t.slug
  }
}, { immediate: true })

// Debug: Watch members data changes
watch(members, (newMembers) => {
  if (import.meta.dev) {
    console.log('[Tenant Members] Members changed:', newMembers.map(m => ({
      id: m.id,
      email: m.user?.email,
      role: m.role,
      roleType: typeof m.role
    })))
  }
}, { deep: true })

const canEdit = computed(() => {
  if (!tenant.value) return false
  if (auth.isSuperAdmin.value) return true
  const role = auth.state.value.data?.tenantRoles[tenant.value.id]
  return role === 'admin'
})

const canInviteMember = computed(() => {
  if (!tenant.value) return false
  // For distributors, only superadmins can invite members
  if (tenant.value.type === 'distributor') {
    return auth.isSuperAdmin.value
  }
  // For providers, admins can invite members
  if (tenant.value.type === 'provider') {
    if (auth.isSuperAdmin.value) return true
    const role = auth.state.value.data?.tenantRoles[tenant.value.id]
    return role === 'admin'
  }
  return false
})

const canManageMembersClient = ref(false)

// Initialize on client only to avoid SSR hydration mismatch
onMounted(() => {
  if (!tenant.value) {
    canManageMembersClient.value = false
    return
  }
  
  // Superadmin ska alltid få hantera medlemmar
  if (auth.state.value.data?.user?.isSuperAdmin) {
    canManageMembersClient.value = true
    return
  }
  
  const tenantId = tenant.value.id
  const role = auth.state.value.data?.tenantRoles?.[tenantId]
  
  if (!role) {
    canManageMembersClient.value = false
    return
  }
  
  // Använd samma permission-key som API-endpointen
  canManageMembersClient.value = tenantRolePermissionMap[role]?.includes('tenants:manage-members') ?? false
})

// Watch for changes in auth state or tenant
watch([() => auth.state.value.data?.user?.isSuperAdmin, () => auth.state.value.data?.tenantRoles, tenant], () => {
  if (!import.meta.client) return
  
  if (!tenant.value) {
    canManageMembersClient.value = false
    return
  }
  
  // Superadmin ska alltid få hantera medlemmar
  if (auth.state.value.data?.user?.isSuperAdmin) {
    canManageMembersClient.value = true
    return
  }
  
  const tenantId = tenant.value.id
  const role = auth.state.value.data?.tenantRoles?.[tenantId]
  
  if (!role) {
    canManageMembersClient.value = false
    return
  }
  
  // Använd samma permission-key som API-endpointen
  canManageMembersClient.value = tenantRolePermissionMap[role]?.includes('tenants:manage-members') ?? false
}, { deep: true })

const canManageMembers = computed(() => {
  // On server, always return false to avoid hydration mismatch
  if (import.meta.server) return false
  
  // On client, use the ref value
  return canManageMembersClient.value
})

const canReadAuditLogs = computed(() => {
  if (!tenant.value) return false
  if (auth.isSuperAdmin.value) return true
  
  // Check if user has audit:read permission for this tenant
  const role = auth.state.value.data?.tenantRoles[tenant.value.id]
  if (role) {
    return tenantRolePermissionMap[role]?.includes('audit:read') ?? false
  }
  
  // Check if user has audit:read permission via tenant hierarchy
  for (const [tenantId, tenantRole] of Object.entries(auth.state.value.data?.tenantRoles ?? {})) {
    if (tenantRolePermissionMap[tenantRole]?.includes('audit:read')) {
      // If user has includeChildren, they can access child tenants
      const includeChildren = auth.state.value.data?.tenantIncludeChildren?.[tenantId] ?? false
      if (includeChildren || tenantId === tenant.value.id) {
        return true
      }
    }
  }
  
  return false
})

const cancelEdit = () => {
  if (tenant.value) {
    editForm.value.name = tenant.value.name
    editForm.value.slug = tenant.value.slug
  }
  isEditing.value = false
  updateError.value = ''
}

const handleSave = async () => {
  if (!tenant.value) return
  saving.value = true
  updateError.value = ''
  
  try {
    await $fetch(`/api/admin/tenants/${tenantId}`, {
      method: 'PUT',
      body: {
        name: editForm.value.name.trim(),
        slug: editForm.value.slug.trim()
      }
    })
    await refresh()
    isEditing.value = false
  } catch (err) {
    updateError.value = err instanceof Error ? err.message : 'Kunde inte spara ändringarna.'
  } finally {
    saving.value = false
  }
}

const canCreateProvider = computed(() => {
  if (!tenant.value) return false
  if (auth.isSuperAdmin.value) return true
  if (tenant.value.type !== 'distributor') return false
  const role = auth.state.value.data?.tenantRoles[tenant.value.id]
  const includeChildren = auth.state.value.data?.tenantIncludeChildren?.[tenant.value.id] ?? false
  return role === 'admin' && includeChildren
})

const canCreateOrganization = computed(() => {
  if (!tenant.value) return false
  if (auth.isSuperAdmin.value) return true
  if (tenant.value.type !== 'provider') return false
  const role = auth.state.value.data?.tenantRoles[tenant.value.id]
  const includeChildren = auth.state.value.data?.tenantIncludeChildren?.[tenant.value.id] ?? false
  return role === 'admin' && includeChildren
})

const canEditTenant = computed(() => {
  if (!tenant.value) return false
  if (auth.isSuperAdmin.value) return true
  const role = auth.state.value.data?.tenantRoles[tenant.value.id]
  return role === 'admin'
})

// Fetch all distributors for editing provider links
interface TenantsResponse {
  tenants: AdminTenantSummary[]
  organizations?: any[]
  distributorProviderLinks?: any[]
}

const { data: distributorsData } = await useFetch<TenantsResponse>('/api/admin/tenants', {
  query: { type: 'distributor' }
})

const allDistributors = computed(() => distributorsData.value?.tenants ?? [])

// Edit distributors modal state
const showEditDistributorsModal = ref(false)
const savingDistributors = ref(false)
const editDistributorsError = ref('')
const editDistributorsForm = ref({
  distributorIds: [] as string[]
})

const openEditDistributorsModal = () => {
  if (tenant.value?.type === 'provider') {
    // Initialize form with currently linked distributors
    editDistributorsForm.value.distributorIds = linkedTenants.value.map(t => t.id)
    editDistributorsError.value = ''
    showEditDistributorsModal.value = true
  }
}

const closeEditDistributorsModal = () => {
  showEditDistributorsModal.value = false
  editDistributorsError.value = ''
}

const handleSaveDistributors = async () => {
  if (!tenant.value || tenant.value.type !== 'provider') return

  savingDistributors.value = true
  editDistributorsError.value = ''

  try {
    await $fetch(`/api/admin/tenants/${tenantId}/providers`, {
      method: 'PUT',
      body: {
        distributorIds: editDistributorsForm.value.distributorIds
      }
    })
    await refresh()
    closeEditDistributorsModal()
  } catch (err: any) {
    editDistributorsError.value = err.data?.message || err.message || 'Kunde inte spara ändringarna.'
  } finally {
    savingDistributors.value = false
  }
}

const navigateToTenant = (id: string) => {
  router.push(`/admin/tenants/${id}`)
}

const navigateToOrg = (slug: string) => {
  router.push(`/admin/organizations/${slug}/overview`)
}

const openDeleteModal = () => {
  if (tenant.value?.type === 'distributor' && auth.isSuperAdmin.value) {
    deleteForm.confirmSlug = ''
    deleteForm.acknowledgeImpact = false
    deleteError.value = ''
    showDeleteModal.value = true
  }
}

const closeDeleteModal = () => {
  showDeleteModal.value = false
  deleteError.value = ''
  deleteForm.confirmSlug = ''
  deleteForm.acknowledgeImpact = false
}

const deleteDisabled = computed(() => {
  return !deleteForm.confirmSlug || !deleteForm.acknowledgeImpact || deleteForm.confirmSlug !== tenant.value?.slug
})

const submitDelete = async () => {
  if (!tenant.value || tenant.value.type !== 'distributor') return
  deleteError.value = ''
  deleteLoading.value = true
  try {
    await $fetch(`/api/admin/tenants/${tenantId}/delete`, {
      method: 'POST',
      body: {
        confirmSlug: deleteForm.confirmSlug.trim(),
        acknowledgeImpact: deleteForm.acknowledgeImpact
      }
    })
    closeDeleteModal()
    router.replace({ path: '/admin/tenants', query: { deleted: tenant.value.slug } })
  } catch (err: any) {
    // Extract error message from API response
    const errorMessage = err?.data?.message || err?.message || 'Kunde inte radera distributören.'
    deleteError.value = errorMessage
  } finally {
    deleteLoading.value = false
  }
}

const checkUserExists = async () => {
  if (!inviteForm.email.trim()) {
    userExists.value = false
    return
  }
  checkingUser.value = true
  try {
    const response = await $fetch<{ exists: boolean }>(`/api/admin/users/check-email`, {
      method: 'POST',
      body: { email: inviteForm.email.trim() }
    }).catch(() => ({ exists: false }))
    userExists.value = response.exists ?? false
    if (userExists.value) {
      inviteForm.createOrganization = false
    }
  } catch {
    userExists.value = false
  } finally {
    checkingUser.value = false
  }
}

const openInviteModal = () => {
  inviteForm.email = ''
  inviteForm.role = 'viewer'
  inviteForm.includeChildren = false
  inviteForm.createOrganization = false
  inviteForm.organization.name = ''
  inviteForm.organization.slug = ''
  inviteForm.organization.billingEmail = ''
  inviteForm.organization.coreId = ''
  userExists.value = false
  checkingUser.value = false
  inviteError.value = ''
  showInviteModal.value = true
}

const closeInviteModal = () => {
  showInviteModal.value = false
  inviteError.value = ''
}

const submitInvite = async () => {
  if (!tenant.value) return
  inviteError.value = ''
  
  // Validate organization data if createOrganization is true
  if (!userExists.value && inviteForm.createOrganization) {
    if (!inviteForm.organization.name.trim()) {
      inviteError.value = 'Organisationsnamn krävs.'
      return
    }
    if (!inviteForm.organization.coreId || inviteForm.organization.coreId.length !== 4) {
      inviteError.value = 'COREID måste vara exakt 4 tecken.'
      return
    }
  }
  
  inviteLoading.value = true
  try {
    const payload: any = {
      email: inviteForm.email.trim(),
      role: inviteForm.role,
      includeChildren: inviteForm.includeChildren
    }
    
    if (!userExists.value && inviteForm.createOrganization) {
      payload.createOrganization = true
      payload.organization = {
        name: inviteForm.organization.name.trim(),
        slug: inviteForm.organization.slug.trim() || undefined,
        billingEmail: inviteForm.organization.billingEmail.trim() || undefined,
        coreId: inviteForm.organization.coreId.trim().toUpperCase()
      }
    }
    
    await $fetch(`/api/admin/tenants/${tenantId}/members/invite`, {
      method: 'POST',
      body: payload
    })
    closeInviteModal()
    await refresh()
  } catch (err: any) {
    inviteError.value = err?.data?.message || err?.message || 'Kunde inte skicka inbjudan.'
  } finally {
    inviteLoading.value = false
  }
}

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'distributor':
      return 'Distributör'
    case 'provider':
      return 'Leverantör'
    case 'organization':
      return 'Organisation'
    default:
      return type
  }
}

const getTypeClass = (type: string) => {
  switch (type) {
    case 'provider':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    case 'distributor':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    case 'organization':
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
  }
}

const setMemberStatus = async (
  member: typeof members.value[0],
  nextStatus: 'active' | 'suspended',
  options: { confirm?: string } = {}
) => {
  if (member.status === nextStatus) return
  if (options.confirm && !confirm(options.confirm)) {
    return
  }
  statusLoadingId.value = member.id
  memberError.value = ''
  try {
    await $fetch(`/api/admin/tenants/${tenantId}/members/${member.id}/status`, {
      method: 'PATCH',
      body: { status: nextStatus }
    })
    await refresh()
  } catch (err: any) {
    memberError.value = err?.data?.message || err?.message || 'Kunde inte uppdatera medlemsstatus.'
  } finally {
    statusLoadingId.value = ''
  }
}

const disableMember = (member: typeof members.value[0]) =>
  setMemberStatus(member, 'suspended', {
    confirm: `Inaktivera ${member.user.email}? Personen kan inte logga in förrän kontot aktiveras igen.`
  })

const enableMember = (member: typeof members.value[0]) => setMemberStatus(member, 'active')

const removeMember = async (member: typeof members.value[0]) => {
  if (!confirm(`Ta bort ${member.user.email} permanent? Personen måste bjudas in igen för att återfå åtkomst.`)) {
    return
  }
  removalLoadingId.value = member.id
  memberError.value = ''
  try {
    await $fetch(`/api/admin/tenants/${tenantId}/members/${member.id}`, {
      method: 'DELETE'
    })
    await refresh()
  } catch (err: any) {
    memberError.value = err?.data?.message || err?.message || 'Kunde inte ta bort medlemmen.'
  } finally {
    removalLoadingId.value = ''
  }
}

const handleRoleChange = async (member: typeof members.value[0], newRole: string) => {
  if (newRole === member.role) return
  
  const oldRole = member.role
  const targetRole = newRole as TenantRole
  
  // Prevent self-demotion from admin to any other role
  if (oldRole === 'admin' && targetRole !== 'admin' && member.userId === auth.user.value?.id) {
    memberError.value = 'Du kan inte nedgradera dina egna admin-rättigheter. Endast andra admins kan göra denna ändring.'
    return
  }
  
  // Confirmation dialogs for admin role changes
  if (oldRole === 'admin' && targetRole !== 'admin') {
    if (!confirm(`Ändra roll för ${member.user.email} från admin till ${targetRole}?`)) {
      return
    }
  } else if (oldRole !== 'admin' && targetRole === 'admin') {
    if (!confirm(`Ge ${member.user.email} admin-rättigheter?`)) {
      return
    }
  }
  
  // Optimistic update
  member.role = targetRole
  roleLoadingId.value = member.id
  memberError.value = ''
  
  try {
    await $fetch(`/api/admin/tenants/${tenantId}/members/${member.id}/role`, {
      method: 'PATCH',
      body: { role: targetRole }
    })
    await refresh()
  } catch (err: any) {
    // Revert optimistic update on error
    member.role = oldRole
    memberError.value = err?.data?.message || err?.message || 'Kunde inte uppdatera rollen.'
  } finally {
    roleLoadingId.value = null
  }
}

const formatDate = (value: string | null) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return value
  }
}

const invitationStatusLabel = (status: string) => {
  if (status === 'pending') return 'Avvaktar'
  if (status === 'accepted') return 'Accepterad'
  if (status === 'cancelled') return 'Avbruten'
  if (status === 'expired') return 'Utgången'
  return status
}

const cancelInvite = async (inviteId: string) => {
  if (!confirm('Vill du verkligen avbryta denna inbjudan?')) {
    return
  }
  inviteCancelLoadingId.value = inviteId
  try {
    await $fetch(`/api/admin/tenants/${tenantId}/invitations/${inviteId}/cancel`, {
      method: 'DELETE'
    })
    await refresh()
  } catch (err: any) {
    memberError.value = err?.data?.message || err?.message || 'Kunde inte avbryta inbjudan.'
  } finally {
    inviteCancelLoadingId.value = ''
  }
}
</script>

