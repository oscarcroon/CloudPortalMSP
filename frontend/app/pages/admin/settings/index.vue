<template>
  <div />
</template>

<script setup lang="ts">
import { navigateTo } from '#imports'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

await navigateTo('/admin/settings/email', { replace: true })
</script>

