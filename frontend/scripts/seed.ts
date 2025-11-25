// @ts-nocheck
import { createId } from '@paralleldrive/cuid2'
import { getDb, resetDbInstance } from '../src/server/utils/db'
import {
  containerInstances,
  containerProjects,
  dnsRecords,
  dnsZones,
  monitoringAlerts,
  ncentralDevices,
  organizationAuthSettings,
  organizationInvitations,
  organizationMemberships,
  organizations,
  tenantMemberships,
  tenants,
  users,
  vmInstances,
  wordpressSites
} from '../src/server/database/schema'
import { hashPassword } from '../src/server/utils/crypto'

const ownerOrgId = 'org-coreit'
const internalOrgId = 'org-internal'
const ownerUserId = 'user-anna'
const viewerUserId = 'user-viewer'
const coreDnsZoneId = 'zone-1'
const internalDnsZoneId = 'zone-2'
const coreContainerProjectId = 'proj-1'
const internalContainerProjectId = 'proj-2'

const isoDate = (value: string) => new Date(value)

const superAdminEmail = process.env.SEED_SUPERADMIN_EMAIL || 'owner@example.com'
const superAdminPassword = process.env.SEED_SUPERADMIN_PASSWORD || 'OwnerPass123!'
const superAdminName = process.env.SEED_SUPERADMIN_NAME || 'Cloud Portal Owner'

const seed = async () => {
  const db = getDb()
  const ownerPasswordHash = await hashPassword(superAdminPassword)
  const viewerPasswordHash = await hashPassword('ViewerPass123!')

  await db.transaction((tx) => {
    // Delete in correct order (respecting foreign keys)
    tx.delete(dnsRecords).run()
    tx.delete(dnsZones).run()
    tx.delete(containerInstances).run()
    tx.delete(ncentralDevices).run()
    tx.delete(monitoringAlerts).run()
    tx.delete(containerProjects).run()
    tx.delete(vmInstances).run()
    tx.delete(wordpressSites).run()
    tx.delete(organizationAuthSettings).run()
    tx.delete(organizationInvitations).run()
    tx.delete(organizationMemberships).run()
    tx.delete(organizations).run()
    tx.delete(tenantMemberships).run()
    tx.delete(tenants).run()
    // Keep users but clear their defaultOrgId
    tx.update(users).set({ defaultOrgId: null }).run()

    // Create tenant structure: Provider -> Distributor -> Organizations
    const providerId = createId()
    const distributorId = createId()

    // 1. Create provider tenant
    tx.insert(tenants)
      .values({
        id: providerId,
        name: 'CoreIT Provider',
        slug: 'coreit-provider',
        type: 'provider',
        parentTenantId: null,
        status: 'active'
      })
      .run()

    // 2. Create distributor tenant under provider
    tx.insert(tenants)
      .values({
        id: distributorId,
        name: 'CoreIT Distributor',
        slug: 'coreit-distributor',
        type: 'distributor',
        parentTenantId: providerId,
        status: 'active'
      })
      .run()

    // 3. Create organizations under distributor
    tx.insert(organizations)
      .values([
        {
          id: ownerOrgId,
          name: 'CoreIT Shared Services',
          slug: 'coreit-shared',
          tenantId: distributorId,
          status: 'active',
          defaultRole: 'owner',
          requireSso: 0,
          allowSelfSignup: 0
        },
        {
          id: internalOrgId,
          name: 'Internal IT',
          slug: 'internal-it',
          tenantId: distributorId,
          status: 'active',
          defaultRole: 'viewer',
          requireSso: 0,
          allowSelfSignup: 0
        }
      ])
      .run()

    // 4. Create organization auth settings
    tx.insert(organizationAuthSettings)
      .values([
        {
          organizationId: ownerOrgId,
          idpType: 'none',
          ssoEnforced: 0,
          allowLocalLoginForOwners: 1
        },
        {
          organizationId: internalOrgId,
          idpType: 'none',
          ssoEnforced: 0,
          allowLocalLoginForOwners: 1
        }
      ])
      .run()

    tx.insert(users)
      .values([
        {
          id: ownerUserId,
          email: superAdminEmail,
          passwordHash: ownerPasswordHash,
          fullName: superAdminName,
          status: 'active',
          defaultOrgId: ownerOrgId,
          isSuperAdmin: 1
        },
        {
          id: viewerUserId,
          email: 'viewer@example.com',
          passwordHash: viewerPasswordHash,
          fullName: 'Site Viewer',
          status: 'active',
          defaultOrgId: internalOrgId
        }
      ])
      .run()

    // 5. Create tenant memberships (super admin as provider admin with includeChildren)
    tx.insert(tenantMemberships)
      .values({
        id: createId(),
        tenantId: providerId,
        userId: ownerUserId,
        role: 'admin',
        includeChildren: true,
        status: 'active'
      })
      .run()

    // 6. Create organization memberships
    tx.insert(organizationMemberships)
      .values([
        {
          id: createId(),
          organizationId: ownerOrgId,
          userId: ownerUserId,
          role: 'owner',
          status: 'active'
        },
        {
          id: createId(),
          organizationId: internalOrgId,
          userId: ownerUserId,
          role: 'admin',
          status: 'active'
        },
        {
          id: createId(),
          organizationId: internalOrgId,
          userId: viewerUserId,
          role: 'viewer',
          status: 'active'
        }
      ])
      .run()

    tx.insert(organizationInvitations)
      .values([
        {
          id: 'invite-coreit-1',
          organizationId: ownerOrgId,
          email: 'new.engineer@example.com',
          role: 'member',
          token: 'inv-coreit-token-1',
          status: 'pending',
          invitedByUserId: ownerUserId,
          expiresAt: isoDate('2025-12-01T00:00:00Z')
        }
      ])
      .run()

    tx.insert(dnsZones)
      .values([
        {
          id: coreDnsZoneId,
          organizationId: ownerOrgId,
          name: 'example.com',
          status: 'active',
          provider: 'cloudflare',
          accountId: 'acc-coreit'
        },
        {
          id: internalDnsZoneId,
          organizationId: internalOrgId,
          name: 'appar.se',
          status: 'active',
          provider: 'cloudflare',
          accountId: 'acc-internal'
        }
      ])
      .run()

    tx.insert(dnsRecords)
      .values([
        {
          id: 'rec-1',
          zoneId: coreDnsZoneId,
          organizationId: ownerOrgId,
          type: 'A',
          name: 'example.com',
          content: '192.0.2.10',
          ttl: 3600,
          proxied: 1
        },
        {
          id: 'rec-2',
          zoneId: coreDnsZoneId,
          organizationId: ownerOrgId,
          type: 'CNAME',
          name: 'www',
          content: 'example.com',
          ttl: 300,
          proxied: 0
        },
        {
          id: 'rec-3',
          zoneId: internalDnsZoneId,
          organizationId: internalOrgId,
          type: 'TXT',
          name: '_spf',
          content: 'v=spf1 include:_spf.google.com ~all',
          ttl: 1800,
          proxied: 0
        }
      ])
      .run()

    tx.insert(containerProjects)
      .values([
        {
          id: coreContainerProjectId,
          organizationId: ownerOrgId,
          name: 'Customer Edge',
          description: 'Exponerar kundnära tjänster',
          environment: 'production'
        },
        {
          id: internalContainerProjectId,
          organizationId: internalOrgId,
          name: 'Internal Apps',
          description: 'Supportverktyg och integrationer',
          environment: 'staging'
        }
      ])
      .run()

    tx.insert(containerInstances)
      .values([
        {
          id: 'ct-1',
          projectId: coreContainerProjectId,
          organizationId: ownerOrgId,
          name: 'dns-forwarder-01',
          status: 'RUNNING',
          image: 'ubuntu:24.04',
          cpu: '2',
          memory: '4GB',
          region: 'eu-north-1',
          metadata: JSON.stringify({ cluster: 'edge', pods: 5 })
        },
        {
          id: 'ct-2',
          projectId: coreContainerProjectId,
          organizationId: ownerOrgId,
          name: 'wp-cache',
          status: 'STOPPED',
          image: 'nginx:1.25',
          cpu: '1',
          memory: '2GB',
          region: 'eu-north-1',
          metadata: JSON.stringify({ cacheHitRatio: 0.82 })
        },
        {
          id: 'ct-3',
          projectId: internalContainerProjectId,
          organizationId: internalOrgId,
          name: 'integration-sync',
          status: 'RUNNING',
          image: 'node:20-alpine',
          cpu: '1',
          memory: '1GB',
          region: 'eu-west-1',
          metadata: JSON.stringify({ schedule: '*/5 * * * *' })
        }
      ])
      .run()

    tx.insert(vmInstances)
      .values([
        {
          id: 'vm-1',
          organizationId: ownerOrgId,
          name: 'wordpress-ha-01',
          platform: 'ESXi',
          powerState: 'poweredOn',
          cpu: '4',
          memory: '8GB',
          disk: '120GB',
          region: 'Karlstad',
          lastBackupAt: isoDate('2025-11-19T05:45:00Z')
        },
        {
          id: 'vm-2',
          organizationId: internalOrgId,
          name: 'morpheus-api-01',
          platform: 'Morpheus',
          powerState: 'poweredOff',
          cpu: '2',
          memory: '4GB',
          disk: '80GB',
          region: 'Stockholm',
          lastBackupAt: isoDate('2025-11-18T22:00:00Z')
        }
      ])
      .run()

    tx.insert(ncentralDevices)
      .values([
        {
          id: 'nc-1',
          organizationId: ownerOrgId,
          name: 'edge-core-01',
          status: 'online',
          type: 'server',
          osVersion: 'Ubuntu 24.04 LTS',
          region: 'Karlstad',
          lastSeenAt: isoDate('2025-11-22T06:45:00Z'),
          metadata: JSON.stringify({ agentVersion: '23.6.1' })
        },
        {
          id: 'nc-2',
          organizationId: ownerOrgId,
          name: 'dc-monitor-02',
          status: 'warning',
          type: 'appliance',
          osVersion: 'Photon 5.0',
          region: 'Stockholm',
          lastSeenAt: isoDate('2025-11-22T05:55:00Z'),
          metadata: JSON.stringify({ probe: 'snmp', packetLoss: 0.12 })
        },
        {
          id: 'nc-3',
          organizationId: internalOrgId,
          name: 'laptop-anna',
          status: 'online',
          type: 'workstation',
          osVersion: 'Windows 11 23H2',
          region: 'Remote',
          lastSeenAt: isoDate('2025-11-22T07:15:00Z'),
          metadata: JSON.stringify({ user: 'anna@example.com' })
        },
        {
          id: 'nc-4',
          organizationId: internalOrgId,
          name: 'fileserver-legacy',
          status: 'offline',
          type: 'server',
          osVersion: 'Windows Server 2016',
          region: 'Göteborg',
          lastSeenAt: isoDate('2025-11-21T18:20:00Z'),
          metadata: JSON.stringify({ maintenanceRequired: true })
        }
      ])
      .run()

    tx.insert(monitoringAlerts)
      .values([
        {
          id: 'alert-1',
          organizationId: ownerOrgId,
          title: 'Disk usage över 90%',
          description: 'edge-core-01 rapporterar diskavvikelse på /var',
          severity: 'critical',
          status: 'open',
          source: 'Prometheus',
          triggeredAt: isoDate('2025-11-22T05:15:00Z'),
          metadata: JSON.stringify({ filesystem: '/var', threshold: 90 })
        },
        {
          id: 'alert-2',
          organizationId: ownerOrgId,
          title: 'Backup misslyckades',
          description: 'Veeam-jobbet nightly-apps har misslyckats två gånger',
          severity: 'warning',
          status: 'acknowledged',
          source: 'Veeam',
          triggeredAt: isoDate('2025-11-21T22:40:00Z'),
          metadata: JSON.stringify({ jobName: 'nightly-apps' })
        },
        {
          id: 'alert-3',
          organizationId: internalOrgId,
          title: 'Agent offline',
          description: 'fileserver-legacy svarar inte på heartbeat',
          severity: 'warning',
          status: 'open',
          source: 'nCentral',
          triggeredAt: isoDate('2025-11-22T03:05:00Z')
        },
        {
          id: 'alert-4',
          organizationId: internalOrgId,
          title: 'Certificate expiring',
          description: 'api.internal.example.com löper ut om 10 dagar',
          severity: 'info',
          status: 'resolved',
          source: 'Let\'s Encrypt',
          triggeredAt: isoDate('2025-11-18T09:30:00Z'),
          resolvedAt: isoDate('2025-11-19T08:00:00Z')
        },
        {
          id: 'alert-5',
          organizationId: ownerOrgId,
          title: 'Hög CPU på incus-nod',
          description: 'incus-core-02 ligger över 85% CPU i 15 minuter',
          severity: 'critical',
          status: 'open',
          source: 'Grafana',
          triggeredAt: isoDate('2025-11-22T07:05:00Z')
        }
      ])
      .run()

    tx.insert(wordpressSites)
      .values([
        {
          id: 'wp-1',
          organizationId: ownerOrgId,
          name: 'Marketing',
          domain: 'marketing.example.com',
          status: 'healthy',
          version: '6.6.2',
          region: 'Karlstad',
          lastBackupAt: isoDate('2025-11-19T05:45:00Z')
        },
        {
          id: 'wp-2',
          organizationId: internalOrgId,
          name: 'Docs',
          domain: 'docs.example.com',
          status: 'warning',
          version: '6.5.3',
          region: 'Karlstad',
          lastBackupAt: isoDate('2025-11-18T22:00:00Z')
        }
      ])
      .run()
  })

  console.log('Seeded organizations, memberships, infra resources and invitations.')
  console.log(`Superadmin credentials -> ${superAdminEmail} / ${superAdminPassword}`)
}

seed()
  .catch((error) => {
    console.error('Failed to seed database:', error)
    process.exitCode = 1
  })
  .finally(() => {
    resetDbInstance()
  })

