<script setup lang="ts">
import { computed } from 'vue'
import { tokenizeJsonForDisplay, type JsonToken } from '@/utils/jsonTokens'
import { expandEmbeddedJson } from '@/utils/jsonExpand'

/**
 * Syntax-highlighted JSON. Values are tokenised by `tokenizeJson` and rendered as isolated `<span>`s
 * — no `v-html`, so nothing here goes through the markdown/DOMPurify path and no markup from a body
 * can ever be interpreted (constitution Principle III). The payload was already truncated + redacted
 * by the debug store before it reached this component.
 *
 * `expand` unfolds embedded JSON string values (e.g. the model's `content` field) into nested blocks
 * for readability; the stored payload is never changed, only the display. The `<pre>` is the scroll
 * container in both axes and wraps long lines at the container edge (overflow-wrap: anywhere), so the
 * slim box scrolls both ways without pushing the panel open.
 */
const props = withDefaults(defineProps<{ code: string; expand?: boolean }>(), {
  expand: false,
})

const tokens = computed<JsonToken[]>(() =>
  tokenizeJsonForDisplay(props.expand ? expandEmbeddedJson(props.code) : props.code),
)

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
  margin: 0;
  max-height: 55vh;
  overflow: auto;
  font-size: 0.75rem;
  line-height: 1.5;
  tab-size: 2;
  /* Long tokens (e.g. base64 or the escaped `content` line) break at the container edge instead of
     forcing a page-wide horizontal scroll; the box still scrolls when a single token exceeds it. */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
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
