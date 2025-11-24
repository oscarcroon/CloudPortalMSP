import { Router } from 'express'
import { z } from 'zod'
import {
  getOrganisationEmailProviderProfile,
  getOrganisationEmailProviderSummary,
  recordTestResult,
  saveOrganisationEmailProvider
} from '../services/emailProviders.js'
import { ensurePermission } from '../utils/authz.js'
import { describeEmailSendError, sendProviderTestEmail } from '../utils/emailTest.js'
import { assertOrganisationScope } from '../utils/organisationScope.js'
import {
  buildProfileFromPayload,
  buildSecretsFromPayload,
  emailProviderPayloadSchema
} from './emailProviderPayload.js'

export const organisationEmailProviderRouter = Router()

const testSchema = emailProviderPayloadSchema.extend({
  testEmail: z.string().email()
})

organisationEmailProviderRouter.get('/:organisationId/email-provider', async (req, res) => {
  if (!ensurePermission(req, res, 'org:read')) {
    return
  }
  const { organisationId } = req.params
  const organisation = await assertOrganisationScope(req, res, organisationId)
  if (!organisation) {
    return
  }
  try {
    const provider = await getOrganisationEmailProviderSummary(organisationId)
    res.json({ organisation, provider })
  } catch (error) {
    console.error('[email-provider] Failed to read org provider', error)
    res.status(500).json({ message: 'Kunde inte läsa organisationens e-postprovider.' })
  }
})

organisationEmailProviderRouter.put('/:organisationId/email-provider', async (req, res) => {
  if (!ensurePermission(req, res, 'org:manage')) {
    return
  }
  const { organisationId } = req.params
  const organisation = await assertOrganisationScope(req, res, organisationId)
  if (!organisation) {
    return
  }
  try {
    const payload = emailProviderPayloadSchema.parse(req.body)
    const existing = await getOrganisationEmailProviderProfile(organisationId)
    const summary = await saveOrganisationEmailProvider(organisationId, {
      fromEmail: payload.fromEmail,
      fromName: payload.fromName,
      replyToEmail: payload.replyToEmail,
      branding: payload.branding ?? null,
      isActive: payload.isActive ?? true,
      provider: buildSecretsFromPayload(payload.provider, payload.fromEmail, existing)
    })
    res.json({ organisation, provider: summary })
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Ogiltig konfiguration.', details: error.flatten() })
      return
    }
    if (error instanceof Error && error.message.includes('krävs')) {
      res.status(400).json({ message: error.message })
      return
    }
    console.error('[email-provider] Failed to save org provider', error)
    res.status(500).json({ message: 'Kunde inte spara organisationens e-postprovider.' })
  }
})

organisationEmailProviderRouter.post('/:organisationId/email-provider/test', async (req, res) => {
  if (!ensurePermission(req, res, 'org:manage')) {
    return
  }
  const { organisationId } = req.params
  const organisation = await assertOrganisationScope(req, res, organisationId)
  if (!organisation) {
    return
  }
  try {
    const payload = testSchema.parse(req.body)
    const profile = buildProfileFromPayload(payload)
    await sendProviderTestEmail(profile, payload.testEmail)
    await recordTestResult(organisationId, 'success')
    res.json({ delivered: true })
  } catch (error) {
    console.error('[email-provider] Org test send failed', error)
    if (error instanceof z.ZodError) {
      await recordTestResult(organisationId, 'failure', 'Ogiltig testpayload.')
      res.status(400).json({ message: 'Ogiltig testpayload.', details: error.flatten() })
      return
    }
    const friendly = describeEmailSendError(error)
    await recordTestResult(organisationId, 'failure', friendly)
    res.status(500).json({ message: friendly })
  }
})

