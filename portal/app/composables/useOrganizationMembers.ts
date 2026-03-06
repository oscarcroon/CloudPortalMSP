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

  const currentOrganizationId = computed(() => auth.state.value.data?.currentOrgId ?? null)

  const assertOrganizationId = () => {
    const id = currentOrganizationId.value
    if (!id) {
      throw new Error('Ingen aktiv organisation vald.')
    }
    return id
  }

  // Cast api calls to avoid excessively deep type instantiation with Nitro route types
  const apiFetch = api as any

  const fetchMembers = async (): Promise<OrganizationMembersResponse> => {
    const organizationId = assertOrganizationId()
    return apiFetch(`/organizations/${organizationId}/members`)
  }

  const inviteMember = async (payload: InviteMemberPayload) => {
    const organizationId = assertOrganizationId()
    return apiFetch(`/organizations/${organizationId}/members/invite`, {
      method: 'POST',
      body: payload
    })
  }

  const cancelInvitation = async (invitationId: string) => {
    const organizationId = assertOrganizationId()
    return apiFetch(`/organizations/${organizationId}/invitations/${invitationId}`, {
      method: 'DELETE'
    })
  }

  const resendInvitation = async (invitationId: string) => {
    const organizationId = assertOrganizationId()
    return apiFetch(`/organizations/${organizationId}/invitations/${invitationId}/resend`, {
      method: 'POST'
    })
  }

  const updateMemberRole = async (memberId: string, role: OrganizationMemberRole) => {
    const organizationId = assertOrganizationId()
    return apiFetch(`/organizations/${organizationId}/members/${memberId}`, {
      method: 'PATCH',
      body: { role }
    })
  }

  const updateMemberStatus = async (memberId: string, status: OrganizationMemberStatus) => {
    const organizationId = assertOrganizationId()
    return apiFetch(`/organizations/${organizationId}/members/${memberId}`, {
      method: 'PATCH',
      body: { status }
    })
  }

  const fetchMemberPermissionOverrides = async (): Promise<{ organizationId: string; userIds: string[] }> => {
    const organizationId = assertOrganizationId()
    return ($fetch as any)(
      `/api/organizations/${organizationId}/members/module-permission-overrides`
    )
  }

  const removeMember = async (memberId: string) => {
    const organizationId = assertOrganizationId()
    return apiFetch(`/organizations/${organizationId}/members/${memberId}`, {
      method: 'DELETE'
    })
  }

  const fetchMemberModuleRoles = async (memberId: string): Promise<MemberModuleRolesResponse> => {
    const organizationId = assertOrganizationId()
    return ($fetch as any)(
      `/api/organizations/${organizationId}/members/${memberId}/module-roles`
    )
  }

  const updateMemberModuleRoles = async (
    memberId: string,
    payload: UpdateMemberModuleRolesPayload
  ): Promise<MemberModuleRolesResponse> => {
    const organizationId = assertOrganizationId()
    return ($fetch as any)(
      `/api/organizations/${organizationId}/members/${memberId}/module-roles`,
      {
        method: 'PUT',
        body: payload
      }
    )
  }

  const fetchMemberModulePermissions = async (memberId: string, moduleId: string): Promise<MemberModulePermissionsResponse> => {
    const organizationId = assertOrganizationId()
    return ($fetch as any)(
      `/api/organizations/${organizationId}/modules/${moduleId}/users/${memberId}`
    )
  }

  const updateMemberModulePermissions = async (
    memberId: string,
    moduleId: string,
    payload: UpdateMemberModulePermissionsPayload
  ): Promise<MemberModulePermissionsResponse> => {
    const organizationId = assertOrganizationId()
    return ($fetch as any)(
      `/api/organizations/${organizationId}/modules/${moduleId}/users/${memberId}`,
      {
        method: 'PUT',
        body: payload
      }
    )
  }

  return {
    currentOrganizationId,
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
