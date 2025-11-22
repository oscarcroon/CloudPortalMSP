import { Router } from 'express'
import { z } from 'zod'
import {
  getGlobalEmailProviderProfile,
  getGlobalEmailProviderSummary,
  recordTestResult,
  saveGlobalEmailProvider
} from '../services/emailProviders.js'
import { ensurePermission } from '../utils/authz.js'
import { sendProviderTestEmail } from '../utils/emailTest.js'
import {
  buildProfileFromPayload,
  buildSecretsFromPayload,
  emailProviderPayloadSchema
} from './emailProviderPayload.js'

export const emailRouter = Router()

const testSchema = emailProviderPayloadSchema.extend({
  testEmail: z.string().email()
})

emailRouter.get('/provider', async (req, res) => {
  if (!ensurePermission(req, res, 'org:manage')) {
    return
  }
  try {
    const provider = await getGlobalEmailProviderSummary()
    res.json({ provider })
  } catch (error) {
    console.error('[email-provider] Failed to load global provider', error)
    res.status(500).json({ message: 'Kunde inte läsa global e-postprovider.' })
  }
})

emailRouter.put('/provider', async (req, res) => {
  if (!ensurePermission(req, res, 'org:manage')) {
    return
  }
  try {
    const payload = emailProviderPayloadSchema.parse(req.body)
    const existing = await getGlobalEmailProviderProfile()
    const summary = await saveGlobalEmailProvider({
      fromEmail: payload.fromEmail,
      fromName: payload.fromName,
      replyToEmail: payload.replyToEmail,
      branding: payload.branding ?? null,
      isActive: payload.isActive ?? true,
      provider: buildSecretsFromPayload(payload.provider, payload.fromEmail, existing)
    })
    res.json({ provider: summary })
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Ogiltig konfiguration.', details: error.flatten() })
      return
    }
    if (error instanceof Error && error.message.includes('krävs')) {
      res.status(400).json({ message: error.message })
      return
    }
    console.error('[email-provider] Failed to save global provider', error)
    res.status(500).json({ message: 'Kunde inte spara global e-postprovider.' })
  }
})

emailRouter.post('/provider/test', async (req, res) => {
  if (!ensurePermission(req, res, 'org:manage')) {
    return
  }
  try {
    const payload = testSchema.parse(req.body)
    const profile = buildProfileFromPayload(payload)
    await sendProviderTestEmail(profile, payload.testEmail)
    await recordTestResult('global', 'success')
    res.json({ delivered: true })
  } catch (error) {
    console.error('[email-provider] Test send failed', error)
    await recordTestResult('global', 'failure', error instanceof Error ? error.message : 'unknown error')
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Ogiltig testpayload.', details: error.flatten() })
      return
    }
    res.status(500).json({ message: error instanceof Error ? error.message : 'Kunde inte skicka testmail.' })
  }
})

