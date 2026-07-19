// Thin re-export: the Material Icon Theme plugin is developed as a standalone
// package (files-workbench-plugins/files-workbench-material-icons), installed
// locally via `npm install` at the repo root. The build bundles it from
// node_modules like any other import; `vue` / `@fw/sdk` stay host-externalized.
export { activate, deactivate } from 'files-workbench-material-icons'
