<script setup lang="ts">
/** Une ligne de télémétrie : libellé, valeur, unité, et une barre facultative. */
defineProps<{
  label: string
  value: string | number
  unit?: string | undefined
  /** Remplissage de 0 à 1. Omis, aucune barre n'est affichée. */
  bar?: number | undefined
  warn?: boolean | undefined
  hint?: string | undefined
}>()
</script>

<template>
  <div class="row" :class="{ warn }">
    <span class="label" :title="hint">{{ label }}</span>
    <span class="value numeric">
      {{ value }}<small v-if="unit"> {{ unit }}</small>
    </span>
    <span v-if="bar !== undefined" class="bar">
      <span class="fill" :style="{ width: Math.round(Math.min(1, Math.max(0, bar)) * 100) + '%' }" />
    </span>
  </div>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: minmax(9rem, 1.4fr) minmax(5rem, auto) minmax(3rem, 1fr);
  align-items: center;
  gap: 0.75rem;
  padding: 0.3rem 0;
  border-bottom: 1px solid var(--line);
}

.row:last-child {
  border-bottom: none;
}

.label {
  color: var(--muted);
}

.value {
  text-align: right;
  white-space: nowrap;
}

.value small {
  color: var(--muted);
  font-size: 0.8em;
}

.warn .value {
  color: var(--warn);
}

.bar {
  display: block;
  height: 5px;
  background: var(--panel-alt);
  border-radius: 3px;
  overflow: hidden;
}

.fill {
  display: block;
  height: 100%;
  background: var(--accent);
}

.warn .fill {
  background: var(--warn);
}
</style>
