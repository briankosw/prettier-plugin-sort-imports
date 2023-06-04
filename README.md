# @briankosw/prettier-plugin-sort-imports

A Prettier plugin that sorts your import declarations.

# Setup

Install the plugin:
```bash
# Yarn
yarn add -D @briankosw/prettier-plugin-sort-imports

# npm
npm install -D @briankosw/prettier-plugin-sort-imports
```

Configure the plugin:
```
{
  "addEmptyLinesBetweenImportGroups": boolean  # default: false
  "importGroups": ["builtin", "src", "*"]      # default: ["builtin", "*"]
}
```

If, for whatever reason, you want the plugin to not run for a file, then add the following pragma to the file:
```
// @briankosw/prettier-plugin-sort-imports:disable
```

Currently, the plugin only supports TypeScript.

# Disclaimer
This plugin modifies the AST of the passed in code, which goes against Prettier's principle of not mutating the AST.
