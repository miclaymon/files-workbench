import { isKnownPermission, isKnownHostPermission } from './permissions.js'

// ── Plugin manifest ───────────────────────────────────────────────────────────
//
// The metadata block every plugin ships (manifest.json), modelled on a Chrome
// extension manifest. The loader validates it before a plugin is granted any API.
//
// @typedef {Object} PluginManifest
// @property {number}   manifest_version   Format version (only SUPPORTED_MANIFEST_VERSION today).
// @property {string}   id                 Unique, kebab-case (a-z, 0-9, hyphen).
// @property {string}   name               Human display name.
// @property {string}   version            Semver (e.g. "1.0.0").
// @property {string}   [description]
// @property {string}   [author]
// @property {string}   [icon]             MDI path or asset reference.
// @property {string}   main               Entry module, relative to the plugin root (e.g. "src/plugin.js").
// @property {string[]} [permissions]      Front-end capabilities (see PERMISSIONS).
// @property {string[]} [host_permissions] Host/backend access (see HOST_PERMISSIONS).
// @property {Object<string,string>} [dependencies]  Plugin id → semver range that must load first.
// @property {Object}   [engines]          e.g. { workbench: "^2.0.0" }.

export const SUPPORTED_MANIFEST_VERSION = 1

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+].+)?$/

/**
 * Validate a manifest. Errors block loading; warnings (e.g. unknown permissions,
 * which are ignored rather than fatal — as Chrome does) are advisory.
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateManifest(manifest) {
  const errors = []
  const warnings = []

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['manifest must be an object'], warnings }
  }

  if (manifest.manifest_version !== SUPPORTED_MANIFEST_VERSION) {
    errors.push(`manifest_version must be ${SUPPORTED_MANIFEST_VERSION} (got ${manifest.manifest_version ?? 'none'})`)
  }
  if (typeof manifest.id !== 'string' || !ID_RE.test(manifest.id)) {
    errors.push('id must be a kebab-case string (a-z, 0-9, hyphen)')
  }
  if (typeof manifest.name !== 'string' || !manifest.name.trim()) {
    errors.push('name is required')
  }
  if (typeof manifest.version !== 'string' || !SEMVER_RE.test(manifest.version)) {
    errors.push('version must be a semver string (e.g. "1.0.0")')
  }
  if (typeof manifest.main !== 'string' || !manifest.main.trim()) {
    errors.push('main (entry module path) is required')
  }

  if (manifest.permissions != null) {
    if (!Array.isArray(manifest.permissions)) errors.push('permissions must be an array')
    else for (const p of manifest.permissions) {
      if (!isKnownPermission(p)) warnings.push(`unknown permission "${p}" (ignored)`)
    }
  }
  if (manifest.host_permissions != null) {
    if (!Array.isArray(manifest.host_permissions)) errors.push('host_permissions must be an array')
    else for (const p of manifest.host_permissions) {
      if (!isKnownHostPermission(p)) warnings.push(`unknown host permission "${p}" (ignored)`)
    }
  }
  if (manifest.dependencies != null && (typeof manifest.dependencies !== 'object' || Array.isArray(manifest.dependencies))) {
    errors.push('dependencies must be an object of { pluginId: versionRange }')
  }

  return { valid: errors.length === 0, errors, warnings }
}

/** Granted permissions, dropping any unknown ones (so callers can trust the list). */
export function grantedPermissions(manifest) {
  return (manifest.permissions ?? []).filter(isKnownPermission)
}
