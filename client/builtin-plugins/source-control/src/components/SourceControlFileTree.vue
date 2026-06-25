<template>
  <ul class="sft" :class="{ 'sft--root': level === 0 }">
    <li v-for="node in nodes" :key="node.key || node.path" class="sft-node">
      <div
        class="sft-item"
        :style="{ paddingLeft: (6 + level * 16 * indentScale) + 'px' }"
        :title="node.path"
        @click="onItemClick(node)"
      >
        <i
          v-for="n in level"
          :key="n"
          class="ig"
          :style="{ left: (12 + (n - 1) * 16 * indentScale) + 'px' }"
        />

        <span
          v-if="isDir(node)"
          class="expand-icon"
          :class="{ expanded: isOpen(node) }"
          @click.stop="toggle(node)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" /></svg>
        </span>
        <span v-else class="expand-spacer" />

        <span class="folder-icon">
          <ResolvedIcon
            v-if="packResult(node) && !failed.has(node.path)"
            :result="packResult(node)"
            :size="16"
            icon-class="pack-icon"
            @fail="failed.add(node.path)"
          />
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiFor(node)" /></svg>
        </span>

        <span class="item-name-label">{{ node.name }}</span>
        <span v-if="node.dir" class="item-dir-label">{{ node.dir }}</span>
        <span v-if="node.status" class="item-status" :class="`item-status--${node.status}`">{{ node.status }}</span>
      </div>

      <SourceControlFileTree
        v-if="isDir(node) && isOpen(node) && node.children.length"
        :nodes="node.children"
        :expanded="expanded"
        :level="level + 1"
        :indentScale="indentScale"
        @toggleExpand="$emit('toggleExpand', $event)"
      />
    </li>
  </ul>
</template>

<script setup>
import { reactive } from 'vue'
import { mdiFile, mdiFolder, mdiFolderOpen } from '@mdi/js'
import { useIconRegistry } from '~/composables/useIconRegistry.js'
import ResolvedIcon from '~/components/workbench/ResolvedIcon.vue'

// Recursive renderer for useDirectoryFileTree output, mirroring the Explorer
// TreeItem look (indent guides, expand chevron, indentScale, icon-pack + MDI
// fallback) without its drag/rename/selection coupling. Directory rows toggle;
// file rows carry a git status badge.
const props = defineProps({
  nodes:       { type: Array,  required: true },
  expanded:    { type: Object, default: () => new Set() },
  level:       { type: Number, default: 0 },
  indentScale: { type: Number, default: 1.0 },
})
const emit = defineEmits(['toggleExpand'])

const { resolveIcon } = useIconRegistry()

// Item paths whose icon SVG failed to load (so we fall back to MDI).
const failed = reactive(new Set())

function isDir(node)  { return node.type === 'directory' }
function isOpen(node) { return isDir(node) && props.expanded?.has?.(node._expandKey) === true }
function toggle(node) { emit('toggleExpand', { expandKey: node._expandKey, path: node.path }) }
function onItemClick(node) { if (isDir(node)) toggle(node) }

// Icon pack (layer 2) — resolve a descriptor for this node through the active theme.
function packResult(node) {
  return resolveIcon({
    path: node.path,
    name: node.name,
    kind: node.type,
    isDir: isDir(node),
    expanded: isOpen(node),
    activityName: 'source-control',
  })
}
function mdiFor(node) {
  if (isDir(node)) return isOpen(node) ? mdiFolderOpen : mdiFolder
  return mdiFile
}
</script>

<style scoped>
.sft { list-style: none; margin: 0; padding: 0; }
.sft--root { padding: 2px 0; }

.sft-node { list-style: none; padding: 0; margin: 0; }

.sft-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px 2px 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text, #ccc);
  white-space: nowrap;
  user-select: none;
}
.sft-item:hover { background: rgba(255, 255, 255, 0.05); }

.ig {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: transparent;
  pointer-events: none;
  transition: background 0.1s;
}

.expand-icon {
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; opacity: 0.6; flex-shrink: 0; width: 16px;
  transform: rotate(0deg); transition: transform 0.15s ease, opacity 0.15s;
}
.expand-icon.expanded { transform: rotate(90deg); }
.expand-icon:hover { opacity: 1; }
.expand-spacer { width: 16px; flex-shrink: 0; }

.folder-icon { display: inline-flex; align-items: center; color: #9e9e9e; flex-shrink: 0; }
.pack-icon { display: block; object-fit: contain; }

.item-name-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.item-dir-label { flex: 1; min-width: 0; font-size: 11px; color: var(--text-muted, #8c8c8c); overflow: hidden; text-overflow: ellipsis; }
.item-status { margin-left: auto; width: 14px; text-align: center; font-size: 12px; font-weight: 600; flex-shrink: 0; }
.item-status--M { color: #e2c08d; }
.item-status--A { color: #73c991; }
.item-status--U { color: #73c991; }
.item-status--D { color: #c74e39; }
.item-status--R { color: #e2c08d; }
</style>
