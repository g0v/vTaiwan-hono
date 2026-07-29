<template>
  <div class="admin-search">
    <IconWrapper name="search" :size="18" class="admin-search__icon" aria-hidden="true" />
    <input :value="modelValue" type="search" class="admin-search__input" :placeholder="placeholder" :aria-label="label" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
    <button v-if="modelValue" type="button" class="admin-search__clear" :aria-label="clearLabel" @click="emit('update:modelValue', '')">
      <IconWrapper name="x" :size="14" />
    </button>
  </div>
</template>

<script setup lang="ts">
import IconWrapper from './IconWrapper.vue'

// 純受控輸入元件：不含過濾邏輯，由呼叫端決定要篩什麼
defineProps<{
  modelValue: string
  placeholder: string
  label: string
  clearLabel: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<style scoped>
.admin-search {
  position: relative;
  width: 100%;
  max-width: 22rem;
}

.admin-search__icon {
  position: absolute;
  top: 50%;
  left: var(--spacing-vt-3);
  transform: translateY(-50%);
  color: var(--color-vt-fg-3);
  pointer-events: none;
}

.admin-search__input {
  width: 100%;
  /* 左右保留 icon / 清除鈕的空間（--spacing-vt-8 = 32px）*/
  padding-block: var(--spacing-vt-2);
  padding-inline: var(--spacing-vt-8);
  font-size: var(--text-vt-sm);
  color: var(--color-vt-fg-1);
  background-color: var(--color-vt-bg-1);
  border: 1px solid var(--color-vt-border);
  border-radius: var(--radius-vt-lg);
  transition: border-color 0.15s ease;
}

.admin-search__input::placeholder {
  color: var(--color-vt-fg-3);
}

.admin-search__input:focus {
  outline: none;
  border-color: var(--color-vt-democratic-red);
  box-shadow: 0 0 0 2px var(--color-vt-red-tint);
}

/* 隱藏瀏覽器原生的 search 清除鈕，統一用自訂按鈕 */
.admin-search__input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
}

.admin-search__clear {
  position: absolute;
  top: 50%;
  right: var(--spacing-vt-1);
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--spacing-vt-6);
  height: var(--spacing-vt-6);
  border-radius: var(--radius-vt-full);
  color: var(--color-vt-fg-3);
  cursor: pointer;
}

.admin-search__clear:hover {
  color: var(--color-vt-fg-1);
  background-color: var(--color-vt-bg-2);
}
</style>
