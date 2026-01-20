import { computed } from '#imports'
import { useApiClient } from './useApiClient'
import { useAuth } from './useAuth'
import type {
  InviteMemberPayload,
  OrganizationMembersResponse,
  OrganizationMemberRole,
  OrganizationMemberStatus,
  MemberModuleRolesResponse,
  MemberModulePermissionsResponse,
  UpdateMemberModuleRolesPayload,
  UpdateMemberModulePermissionsPayload
} from '~/types/members'

export const useOrganizationMembers = () => {
  const api = useApiClient()
  const auth = useAuth()

  const currentOrganisationId = computed(() => auth.state.value.data?.currentOrgId ?? null)

  const assertOrganisationId = () => {
    const id = currentOrganisationId.value
    if (!id) {
      throw new Error('Ingen aktiv organisation vald.')
    }
    return id
  }

  const fetchMembers = async () => {
    const organisationId = assertOrganisationId()
    return api<OrganizationMembersResponse>(`/organisations/${organisationId}/members`)
  }

  const inviteMember = async (payload: InviteMemberPayload) => {
    const organisationId = assertOrganisationId()
    return api(`/organisations/${organisationId}/members/invite`, {
      method: 'POST',
      body: payload
    })
  }

  const cancelInvitation = async (invitationId: string) => {
    const organisationId = assertOrganisationId()
    return api(`/organisations/${organisationId}/invitations/${invitationId}`, {
      method: 'DELETE'
    })
  }

  const resendInvitation = async (invitationId: string) => {
    const organisationId = assertOrganisationId()
    return api(`/organisations/${organisationId}/invitations/${invitationId}/resend`, {
      method: 'POST'
    })
  }

  const updateMemberRole = async (memberId: string, role: OrganizationMemberRole) => {
    const organisationId = assertOrganisationId()
    return api(`/organisations/${organisationId}/members/${memberId}`, {
      method: 'PATCH',
      body: { role }
    })
  }

  const updateMemberStatus = async (memberId: string, status: OrganizationMemberStatus) => {
    const organisationId = assertOrganisationId()
    return api(`/organisations/${organisationId}/members/${memberId}`, {
      method: 'PATCH',
      body: { status }
    })
  }

  const fetchMemberPermissionOverrides = async () => {
    const organisationId = assertOrganisationId()
    return $fetch<{ organizationId: string; userIds: string[] }>(
      `/api/organizations/${organisationId}/members/module-permission-overrides`
    )
  }

  const removeMember = async (memberId: string) => {
    const organisationId = assertOrganisationId()
    return api(`/organisations/${organisationId}/members/${memberId}`, {
      method: 'DELETE'
    })
  }

  const fetchMemberModuleRoles = async (memberId: string) => {
    const organisationId = assertOrganisationId()
    return $fetch<MemberModuleRolesResponse>(
      `/api/organizations/${organisationId}/members/${memberId}/module-roles`
    )
  }

  const updateMemberModuleRoles = async (
    memberId: string,
    payload: UpdateMemberModuleRolesPayload
  ) => {
    const organisationId = assertOrganisationId()
    return $fetch<MemberModuleRolesResponse>(
      `/api/organizations/${organisationId}/members/${memberId}/module-roles`,
      {
        method: 'PUT',
        body: payload
      }
    )
  }

  const fetchMemberModulePermissions = async (memberId: string, moduleId: string) => {
    const organisationId = assertOrganisationId()
    return $fetch<MemberModulePermissionsResponse>(
      `/api/organizations/${organisationId}/modules/${moduleId}/users/${memberId}`
    )
  }

  const updateMemberModulePermissions = async (
    memberId: string,
    moduleId: string,
    payload: UpdateMemberModulePermissionsPayload
  ) => {
    const organisationId = assertOrganisationId()
    return $fetch<MemberModulePermissionsResponse>(
      `/api/organizations/${organisationId}/modules/${moduleId}/users/${memberId}`,
      {
        method: 'PUT',
        body: payload
      }
    )
  }

  return {
    currentOrganisationId,
    fetchMembers,
    inviteMember,
    updateMemberRole,
    updateMemberStatus,
    removeMember,
    cancelInvitation,
    resendInvitation,
    fetchMemberPermissionOverrides,
    fetchMemberModuleRoles,
    updateMemberModuleRoles,
    fetchMemberModulePermissions,
    updateMemberModulePermissions
  }
}


