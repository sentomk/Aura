<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ content: string }>();

function renderMarkdown(md: string): string {
  if (!md) return '';
  let html = md
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    // Bold / italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    // Unordered lists
    .replace(/^[\s]*[-*+] (.+)$/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^[\s]*\d+\. (.+)$/gm, '<li>$1</li>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr>')
    // Paragraphs - wrap lines that aren't already tags
    .replace(/^(?!<[hcl]|<hr)(.+)$/gm, '<p>$1</p>')
    // Clean up empty paragraphs
    .replace(/<p><\/p>/g, '')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>');

  return html;
}

const rendered = computed(() => renderMarkdown(props.content));
</script>

<template>
  <div class="markdown-body" v-html="rendered" />
</template>

<style scoped>
.markdown-body :deep(h2) {
  font-size: 20px;
  font-weight: 700;
  color: #1a1818;
  margin: 24px 0 12px;
}
.markdown-body :deep(h3) {
  font-size: 17px;
  font-weight: 600;
  color: #2c2a29;
  margin: 20px 0 10px;
}
.markdown-body :deep(h4) {
  font-size: 15px;
  font-weight: 600;
  color: #2c2a29;
  margin: 16px 0 8px;
}
.markdown-body :deep(p) {
  margin: 8px 0;
  line-height: 1.7;
  color: #5c5855;
}
.markdown-body :deep(ul) {
  padding-left: 20px;
  margin: 8px 0;
}
.markdown-body :deep(li) {
  line-height: 1.8;
  color: #5c5855;
}
.markdown-body :deep(strong) {
  font-weight: 600;
  color: #2c2a29;
}
.markdown-body :deep(code) {
  background: #f7f5f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 13px;
  color: #c43228;
}
.markdown-body :deep(a) {
  color: #5c5855;
}
.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid #e8e4db;
  margin: 20px 0;
}
</style>
