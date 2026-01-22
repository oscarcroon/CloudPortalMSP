/**
 * Clamp boolean capability objects by intersecting module-level rights with resource-level rights.
 * Returns a new object; does not mutate inputs.
 */
export const clampBooleanCapabilities = <T extends Record<string, boolean>>(
  moduleRights: T,
  resourceRights: Partial<T>
): T => {
  const result = { ...moduleRights }
  for (const key of Object.keys(result) as Array<keyof T>) {
    const resourceValue = resourceRights[key]
    if (typeof resourceValue === 'boolean') {
      result[key] = Boolean(result[key] && resourceValue) as T[keyof T]
    }
  }
  return result
}




