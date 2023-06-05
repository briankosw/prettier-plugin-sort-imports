/**
 * A set of Node.js built-in modules.
 *
 * @link https://nodejs.org/api/index.html
 */
export const NODE_BUILT_IN_MODULES = new Set([
  "assert",
  "buffer",
  "child_process",
  "cluster",
  "crypto",
  "dgram",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "https",
  "net",
  "os",
  "path",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "tls",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "zlib",
]);

export const BUILTIN_IMPORT_GROUP_NAME = "builtin";
export const ET_CETERA_IMPORT_GROUP_NAME = "*";

export const DISABLE_PRAGMA = "@briankosw/prettier-plugin-sort-imports:disable";
