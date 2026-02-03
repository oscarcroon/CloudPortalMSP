type SimpleFetch = <T = any>(url: string, opts?: Record<string, any>) => Promise<T>

export const useApiClient = (): SimpleFetch => {
  const config = useRuntimeConfig()

  return $fetch.create({
    baseURL: config.public.apiBase,
    credentials: 'include'
  }) as unknown as SimpleFetch
}

