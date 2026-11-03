<script setup lang="ts">
import { computed } from 'vue'
import { tokenizeJsonForDisplay, renderJsonValue, type JsonToken } from '@/utils/jsonTokens'

/**
 * Syntax-highlighted JSON. In the default expanded mode the payload is parsed and rendered from its
 * value tree, which lets the component show string values unescaped and as a distinct multi-line
 * box (the model's `content` field) while keeping the surrounding structure truthful. When the
 * payload isn't valid JSON — or when "Show raw" is picked — it falls back to the text tokenizer.
 *
 * Tokens are rendered as isolated `<span>`s — no `v-html`, so nothing goes through the
 * markdown/DOMPurify path and no markup from a body can ever be interpreted (Principle III). The
 * payload was already truncated + redacted by the debug store.
 */
const props = withDefaults(defineProps<{ code: string; expand?: boolean }>(), {
  expand: true,
})

function tryParse(code: string): unknown {
  try {
    return JSON.parse(code)
  } catch {
    return null
  }
}

const tokens = computed<JsonToken[]>(() => {
  if (props.expand) {
    const parsed = tryParse(props.code)
    if (parsed !== null) return renderJsonValue(parsed, true)
  }
  return tokenizeJsonForDisplay(props.code)
})

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
    case 'decoded':
      return 'json-decoded'
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
/* A long / multi-line string value sits as a decoded box on its own line. */
.json-decoded {
  display: inline-block;
  vertical-align: top;
  max-width: 100%;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: color-mix(in oklab, var(--color-accent) 12%, transparent);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.25em 0.35em;
}
</style>
