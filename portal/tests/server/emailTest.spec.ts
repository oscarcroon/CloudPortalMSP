import { describe, expect, it } from 'vitest'
import { describeEmailSendError } from '~~/server/utils/emailTest'

describe('describeEmailSendError', () => {
  it('ger tydligt felmeddelande för självsignerade certifikat', () => {
    const message = describeEmailSendError(new Error('self-signed certificate in certificate chain'))
    expect(message).toMatch(/självsignerat certifikat/i)
  })

  it('faller tillbaka till originalmeddelandet för övriga fel', () => {
    const message = describeEmailSendError(new Error('Mailbox unavailable'))
    expect(message).toBe('Mailbox unavailable')
  })
})


