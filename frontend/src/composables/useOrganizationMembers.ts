import { computed } from '#imports'
import { useApiClient } from './useApiClient'
import { useAuth } from './useAuth'
import type {
  InviteMemberPayload,
  OrganizationMembersResponse,
  OrganizationMemberRole
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

  const updateMemberRole = async (memberId: string, role: OrganizationMemberRole) => {
    const organisationId = assertOrganisationId()
    return api(`/organisations/${organisationId}/members/${memberId}`, {
      method: 'PATCH',
      body: { role }
    })
  }

  const removeMember = async (memberId: string) => {
    const organisationId = assertOrganisationId()
    return api(`/organisations/${organisationId}/members/${memberId}`, {
      method: 'DELETE'
    })
  }

  return {
    currentOrganisationId,
    fetchMembers,
    inviteMember,
    updateMemberRole,
    removeMember
  }
}


