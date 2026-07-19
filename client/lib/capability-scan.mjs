// ── Plugin capability scan ────────────────────────────────────────────────────
//
// A static scan of a built client bundle for ambient-authority use. It is NOT a
// security boundary (an in-realm module can always reach globals through other
// references) — it raises the bar and makes intent auditable:
//   • the build hard-fails a first-party plugin that uses CODE-EXECUTION primitives
//     (eval / Function constructor / dynamic import / Worker) — obfuscation red flags;
//   • CAPABILITY use (network / storage / clipboard) is reported so a plugin routes it
//     through the matching `api` slice + declared permission, and is surfaced to the
//     user at third-party install consent.
//
// Shared by the Node build (client/scripts/build-plugins.js, via dynamic import) and
// the browser (the Plugins manager's install-consent scan) — one source of truth.

// Each rule: a token name, a detection pattern, the permission that legitimizes it
// (null = never legitimized), and a severity.
//   'high'       — code execution / loading; a first-party build fails on these.
//   'capability' — needs the matching permission; advisory for first-party, shown at
//                  third-party consent.
export const CAPABILITY_RULES = [
  { token: 'eval',            pattern: /\beval\s*\(/,                              permission: null,        severity: 'high' },
  { token: 'Function(...)',   pattern: /\bnew\s+Function\s*\(|\bFunction\s*\(\s*['"`]/, permission: null,   severity: 'high' },
  { token: 'import(...)',     pattern: /\bimport\s*\(/,                            permission: null,        severity: 'high' },
  { token: 'Worker',          pattern: /\bnew\s+(?:Shared)?Worker\s*\(|\bimportScripts\s*\(/, permission: null, severity: 'high' },
  { token: 'fetch',           pattern: /\bfetch\s*\(/,                             permission: 'net',       severity: 'capability' },
  { token: 'XMLHttpRequest',  pattern: /\bXMLHttpRequest\b/,                       permission: 'net',       severity: 'capability' },
  { token: 'WebSocket',       pattern: /\bWebSocket\b/,                            permission: 'net',       severity: 'capability' },
  { token: 'EventSource',     pattern: /\bEventSource\b/,                          permission: 'net',       severity: 'capability' },
  { token: 'sendBeacon',      pattern: /\bsendBeacon\s*\(/,                        permission: 'net',       severity: 'capability' },
  { token: 'localStorage',    pattern: /\blocalStorage\b/,                         permission: 'storage',   severity: 'capability' },
  { token: 'sessionStorage',  pattern: /\bsessionStorage\b/,                       permission: 'storage',   severity: 'capability' },
  { token: 'indexedDB',       pattern: /\bindexedDB\b/,                            permission: 'storage',   severity: 'capability' },
  { token: 'navigator.clipboard', pattern: /navigator\s*\.\s*clipboard\b/,         permission: 'clipboard', severity: 'capability' },
  { token: 'document.cookie', pattern: /document\s*\.\s*cookie\b/,                 permission: null,        severity: 'capability' },
]

/**
 * Scan bundle source for ambient-authority tokens.
 * @returns {Array<{ token, permission, severity, count }>}
 */
export function scanCapabilities(code) {
  const findings = []
  for (const r of CAPABILITY_RULES) {
    const g = new RegExp(r.pattern.source, 'g')
    const count = (String(code).match(g) || []).length
    if (count > 0) findings.push({ token: r.token, permission: r.permission, severity: r.severity, count })
  }
  return findings
}

/**
 * Findings a plugin's granted permissions do NOT cover: every 'high' finding, plus any
 * 'capability' finding whose permission wasn't declared.
 */
export function uncoveredFindings(findings, permissions = []) {
  const set = new Set(permissions)
  return findings.filter((f) => f.severity === 'high' || !(f.permission && set.has(f.permission)))
}
