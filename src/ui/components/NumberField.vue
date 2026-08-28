<script setup lang="ts">
/**
 * Champ numérique de l'écran de configuration.
 *
 * Curseur et saisie directe côte à côte : le curseur sert au réglage à l'oreille
 * pendant que ça tourne, la saisie sert à reposer une valeur exacte. Les bornes
 * sont indicatives sur le curseur, la saisie les respecte aussi — un régime de
 * rupteur négatif n'a pas de sens et casserait le calcul de mixage.
 */
const props = defineProps<{
  label: string
  modelValue: number
  min: number
  max: number
  step: number
  unit?: string | undefined
  hint?: string | undefined
}>()

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function clamp(value: number): number {
  if (!Number.isFinite(value)) return props.min
  return Math.min(props.max, Math.max(props.min, value))
}

function onInput(event: Event): void {
  emit('update:modelValue', clamp(Number((event.target as HTMLInputElement).value)))
}
</script>

<template>
  <div class="field">
    <label class="head">
      <span class="label">{{ label }}</span>
      <span class="entry">
        <input
          type="number"
          :value="modelValue"
          :min="min"
          :max="max"
          :step="step"
          @input="onInput"
        />
        <span v-if="unit" class="unit">{{ unit }}</span>
      </span>
    </label>
    <input
      type="range"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      @input="onInput"
    />
    <p v-if="hint" class="hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.field {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--line);
}

.field:last-child {
  border-bottom: none;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.label {
  color: var(--text);
}

.entry {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  flex: 0 0 auto;
}

.entry input {
  width: 6.5rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.unit {
  color: var(--muted);
  font-size: 0.85rem;
  min-width: 3.2rem;
}

.hint {
  color: var(--muted);
  font-size: 0.82rem;
  margin: 0.25rem 0 0;
}
</style>
