<script setup lang="ts">
import { computed } from 'vue'
import { tokenizeJsonForDisplay, type JsonToken } from '@/utils/jsonTokens'

/**
 * Syntax-highlighted JSON. Values are tokenised by `tokenizeJson` and rendered as isolated `<span>`s
 * — no `v-html`, so nothing here goes through the markdown/DOMPurify path and no markup from a body
 * can ever be interpreted (constitution Principle III). The payload was already truncated + redacted
 * by the debug store before it reached this component.
 */
const props = defineProps<{ code: string }>()

const tokens = computed<JsonToken[]>(() => tokenizeJsonForDisplay(props.code))

function classFor(type: JsonToken['type']): string {
  switch (type) {
    case 'key':
      return 'json-key'
    case 'string':
      return 'json-string'
    case 'number':
      return 'json-number'
    case 'literal':
      return 'json-literal'
    case 'text':
      return 'json-text'
    default:
      return ''
  }
}
</script>

<template>
  <pre class="json-pre"><span
      v-for="(token, i) in tokens"
      :key="i"
      :class="classFor(token.type)"
    >{{ token.text }}</span></pre>
</template>

<style scoped>
.json-pre {
  overflow-x: auto;
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.5;
  tab-size: 2;
  white-space: pre;
}
.json-key {
  color: var(--color-accent);
  font-weight: 600;
}
.json-string {
  color: var(--color-ok);
}
.json-number {
  color: var(--color-accent);
}
.json-literal {
  color: var(--color-accent);
}
.json-text {
  color: var(--color-fg-muted);
}
</style>
