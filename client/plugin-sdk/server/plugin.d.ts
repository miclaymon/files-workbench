// Shared extism JS PDK interface for every server plugin. Passed to `extism-js`
// via `-i`. Exports are the three fixed entry points the ServerPlugin SDK provides;
// imports are the full host-function set — the Go host registers all of them and
// enforces the plugin's granted permissions at call time, so declaring the whole
// set here never mismatches what the host provides.

declare module "main" {
  export function handle(): I32;
  export function plugin_init(): I32;
  export function plugin_destroy(): I32;
}

declare module "extism:host" {
  interface user {
    host_exec(offset: I64): I64;
    host_fs_stat(offset: I64): I64;
    host_fs_read_dir(offset: I64): I64;
    host_fs_read_file(offset: I64): I64;
    host_log(offset: I64): I64;
  }
}
