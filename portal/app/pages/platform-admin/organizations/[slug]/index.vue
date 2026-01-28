<template>
  <div />
</template>

<script setup lang="ts">
import { navigateTo, useRoute } from '#imports'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const route = useRoute()
await navigateTo(`/platform-admin/organizations/${route.params.slug}/overview`, { replace: true })
</script>

