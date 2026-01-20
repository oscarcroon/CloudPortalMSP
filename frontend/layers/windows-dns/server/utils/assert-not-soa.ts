import { createError } from 'h3'

const SOA_ERROR_MESSAGE = 'SOA hanteras via Zone settings.'

/**
 * Check if a record type is SOA (case-insensitive).
 */
export function isSoaType(type: unknown): boolean {
  return String(type ?? '').trim().toUpperCase() === 'SOA'
}

/**
 * Assert that the record type is not SOA.
 * Throws 403 if it is SOA.
 *
 * @param type - The record type to check
 * @throws H3Error with 403 status if type is SOA
 */
export function assertNotSoa(type: unknown): void {
  if (isSoaType(type)) {
    throw createError({
      statusCode: 403,
      message: SOA_ERROR_MESSAGE
    })
  }
}

/**
 * Assert that a record is not SOA by looking up the record in a list.
 * Use this when the type is not provided (e.g., in PATCH without type).
 *
 * @param recordId - The record ID to look up
 * @param records - List of records to search
 * @throws H3Error with 403 status if the record is SOA
 */
export function assertRecordNotSoa(
  recordId: string,
  records: Array<{ id?: string; type?: string }>
): void {
  const record = records.find(r => r.id === recordId)
  if (record && isSoaType(record.type)) {
    throw createError({
      statusCode: 403,
      message: SOA_ERROR_MESSAGE
    })
  }
}

