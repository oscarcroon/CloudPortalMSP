export const useApiClient = () => {
  const config = useRuntimeConfig()
  const baseURL = process.server ? config.apiBase : config.public.apiBase

  return $fetch.create({
    baseURL,
    credentials: 'include'
  })
}

