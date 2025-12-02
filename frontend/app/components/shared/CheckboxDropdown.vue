<template>
  <div ref="dropdownRoot" class="relative" v-click-outside="closeDropdown">
    <button
      type="button"
      ref="buttonRef"
      class="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
      :disabled="disabled"
      @click.stop="toggleDropdown"
    >
      <span class="min-w-[120px] text-left">
        {{ pendingCount > 0 ? `${pendingCount} valda` : (selectedCount > 0 ? `${selectedCount} valda` : 'Välj roller...') }}
      </span>
      <Icon
        icon="mdi:chevron-down"
        class="h-4 w-4 transition-transform"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="transform opacity-0 scale-95"
        enter-to-class="transform opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="transform opacity-100 scale-100"
        leave-to-class="transform opacity-0 scale-95"
      >
        <div
          v-if="isOpen"
          ref="dropdownRef"
          class="fixed z-[10000] w-[320px] rounded-lg border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0c1524]"
          :style="dropdownStyle"
          @click.stop
          @mousedown.stop
        >
        <div class="border-b border-slate-200 p-3 dark:border-white/10">
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="text"
            placeholder="Sök roller..."
            class="w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
            @keydown.esc="closeDropdown"
            @click.stop
            @mousedown.stop
          />
        </div>
        <div class="max-h-[300px] overflow-y-auto p-2">
          <div v-if="filteredOptions.length === 0" class="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
            Inga roller hittades
          </div>
          <label
            v-for="option in filteredOptions"
            :key="option.value"
            class="flex items-start gap-3 rounded px-3 py-2 text-sm transition hover:bg-slate-50 dark:hover:bg-white/5"
            :class="{ 'bg-slate-50 dark:bg-white/5': isSelected(option.value) }"
            @click.stop
            @mousedown.stop
          >
            <input
              type="checkbox"
              :checked="isSelected(option.value)"
              class="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand dark:border-white/20"
              @change="toggleOption(option.value, $event)"
              @click.stop
              @mousedown.stop
            />
            <div class="flex-1">
              <div class="font-medium text-slate-900 dark:text-white">{{ option.label }}</div>
              <div v-if="option.description" class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {{ option.description }}
              </div>
            </div>
          </label>
        </div>
        <div class="border-t border-slate-200 p-2 dark:border-white/10">
          <div class="flex gap-2">
            <button
              v-if="pendingCount > 0"
              type="button"
              class="flex-1 rounded bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
              @click.stop="clearPendingSelection"
              @mousedown.stop
            >
              Rensa
            </button>
            <button
              type="button"
              class="flex-1 rounded bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
              :disabled="!hasPendingChanges || saving"
              @click.stop="saveSelection"
              @mousedown.stop
            >
              {{ saving ? 'Sparar...' : 'Spara' }}
            </button>
            <button
              type="button"
              class="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              @click.stop="closeDropdown"
              @mousedown.stop
            >
              Avbryt
            </button>
          </div>
        </div>
      </div>
    </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'

interface Option {
  value: string
  label: string
  description?: string
}

const props = defineProps<{
  options: Option[]
  modelValue: string[]
  disabled?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  'save': [value: string[]]
}>()

const isOpen = ref(false)
const searchQuery = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const buttonRef = ref<HTMLButtonElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const dropdownRoot = ref<HTMLElement | null>(null)
const pendingValues = ref<string[]>([])
const saving = ref(false)

const filteredOptions = computed(() => {
  if (!searchQuery.value.trim()) {
    return props.options
  }
  const query = searchQuery.value.toLowerCase()
  return props.options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(query) ||
      opt.value.toLowerCase().includes(query) ||
      opt.description?.toLowerCase().includes(query)
  )
})

const selectedCount = computed(() => props.modelValue.length)
const pendingCount = computed(() => pendingValues.value.length)
const hasPendingChanges = computed(() => {
  if (pendingValues.value.length !== props.modelValue.length) return true
  return pendingValues.value.some(v => !props.modelValue.includes(v)) ||
    props.modelValue.some(v => !pendingValues.value.includes(v))
})

const dropdownStyle = ref<Record<string, string>>({})

const updateDropdownPosition = () => {
  if (!buttonRef.value || !isOpen.value) {
    dropdownStyle.value = {}
    return
  }
  const rect = buttonRef.value.getBoundingClientRect()
  dropdownStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    position: 'fixed'
  }
}

// Update position on scroll/resize
const updatePosition = () => {
  updateDropdownPosition()
}

watch(isOpen, (open) => {
  if (open) {
    nextTick(() => {
      updateDropdownPosition()
    })
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
  } else {
    window.removeEventListener('scroll', updatePosition, true)
    window.removeEventListener('resize', updatePosition)
  }
})

watch(isOpen, (open) => {
  if (open) {
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
  } else {
    window.removeEventListener('scroll', updatePosition, true)
    window.removeEventListener('resize', updatePosition)
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
})

const isSelected = (value: string) => pendingValues.value.includes(value)

const toggleOption = (value: string, event: Event) => {
  const checked = (event.target as HTMLInputElement).checked
  if (checked) {
    pendingValues.value = [...pendingValues.value, value]
  } else {
    pendingValues.value = pendingValues.value.filter((v) => v !== value)
  }
}

const clearPendingSelection = () => {
  pendingValues.value = []
}

const saveSelection = async () => {
  if (saving.value) return
  saving.value = true
  try {
    emit('save', [...pendingValues.value])
    emit('update:modelValue', [...pendingValues.value])
    closeDropdown()
  } finally {
    saving.value = false
  }
}

const toggleDropdown = async (event?: Event) => {
  if (props.disabled) return
  event?.stopPropagation()
  const wasOpen = isOpen.value
  isOpen.value = !isOpen.value
  
  if (isOpen.value && !wasOpen) {
    // Initialize pending values from current modelValue when opening
    pendingValues.value = [...props.modelValue]
    await nextTick()
    searchInput.value?.focus()
  } else if (!isOpen.value) {
    // Reset pending values when closing without saving
    pendingValues.value = [...props.modelValue]
    searchQuery.value = ''
  }
}

const closeDropdown = () => {
  isOpen.value = false
  searchQuery.value = ''
  // Reset pending values to match current state
  pendingValues.value = [...props.modelValue]
}

// Close on escape key
onMounted(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen.value) {
      closeDropdown()
    }
  }
  document.addEventListener('keydown', handleEscape)
  return () => {
    document.removeEventListener('keydown', handleEscape)
  }
})

// Directive for click outside
const vClickOutside = {
  mounted(el: HTMLElement & { clickOutsideEvent?: (event: MouseEvent) => void }, binding: { value: () => void }) {
    el.clickOutsideEvent = (event: MouseEvent) => {
      const target = event.target as Node
      // Check if click is outside both the root element and the dropdown (which is teleported)
      const isOutsideRoot = el && !el.contains(target)
      const isOutsideDropdown = dropdownRef.value && !dropdownRef.value.contains(target)
      
      if (isOutsideRoot && isOutsideDropdown) {
        // Use setTimeout to ensure this runs after the toggle handler
        setTimeout(() => {
          binding.value()
        }, 0)
      }
    }
    document.addEventListener('mousedown', el.clickOutsideEvent!)
  },
  unmounted(el: HTMLElement & { clickOutsideEvent?: (event: MouseEvent) => void }) {
    if (el.clickOutsideEvent) {
      document.removeEventListener('mousedown', el.clickOutsideEvent)
    }
  }
}
</script>

