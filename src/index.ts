import { parse, AST_NODE_TYPES } from "@typescript-eslint/typescript-estree";
import isBuiltinModule from "is-builtin-module";
import { Plugin } from "prettier/index";
import typescriptParser from "prettier/plugins/typescript";

import {
  BUILTIN_IMPORT_GROUP_NAME,
  DISABLE_PRAGMA,
  ET_CETERA_IMPORT_GROUP_NAME,
} from "./constants";
import { ImportSource, LineRange, Options } from "./types";
import { sortImport, validateImportGroups } from "./utils";

export const options = {
  addEmptyLinesBetweenImportGroups: {
    type: "boolean",
    category: "Global",
    default: true,
    description: "If true, empty lines will be added in between import groups.",
    since: "0.0.0",
  },
  importGroups: {
    type: "string",
    category: "Global",
    array: true,
    default: [{ value: ["builtin", "*"] }],
    description:
      "The groups to sort the imports into. The allowed values are " +
      "'builtin', '*', and any string that is a valid regular expression, " +
      "where any import that is neither a builtin module nor matches any of " +
      "the regular expressions will be sorted into the '*' import group.",
    since: "0.0.0",
  },
};

export const parsers: Plugin["parsers"] = {
  typescript: {
    ...typescriptParser.parsers.typescript,
    preprocess: (text: string, options: Options) => {
      // Skip sorting imports if the `DISABLE_PRAGMA` is present.
      if (text.includes(DISABLE_PRAGMA)) {
        return text;
      }
      if (options.importGroups == null) {
        return text;
      }
      validateImportGroups(options.importGroups);
      const enableJsx = options.filepath?.endsWith("tsx");
      const ast = parse(text, {
        loc: true,
        jsx: enableJsx,
      });
      const body = ast.body;
      // Grab all the import declarations along with their indices in the list
      // of AST nodes.
      const importDeclarations = body
        .map((declaration, idx) => {
          return {
            declaration,
            idx,
          };
        })
        .filter(({ declaration }) => {
          return declaration.type === AST_NODE_TYPES.ImportDeclaration;
        })
        .map(({ declaration, idx }) => {
          return {
            declaration,
            idx,
          };
        });
      if (importDeclarations.length === 0) {
        return text;
      }
      let etCeteraIdx = -1;
      const regexList = options.importGroups.map((importRegexStr, idx) => {
        switch (importRegexStr) {
          case ET_CETERA_IMPORT_GROUP_NAME:
            etCeteraIdx = idx;
          case BUILTIN_IMPORT_GROUP_NAME:
            return importRegexStr;
          default:
            return new RegExp(importRegexStr);
        }
      });
      // Group the import declarations based on the groups defined by the
      // `importGroups` option.
      const importDeclarationGroups = Array.from(
        { length: regexList.length },
        () => [] as { range: LineRange; importSource: ImportSource }[],
      );
      for (const { declaration } of importDeclarations) {
        if (declaration.type !== AST_NODE_TYPES.ImportDeclaration) {
          continue;
        }
        const source = declaration.source.value;
        const sourceModule = declaration.source.value.split("/", 1)[0];
        let i = 0;
        for (; i < regexList.length; i++) {
          const regex = regexList[i];
          if (typeof regex === "string") {
            if (regex === BUILTIN_IMPORT_GROUP_NAME) {
              if (isBuiltinModule(sourceModule)) {
                importDeclarationGroups[i].push({
                  range: {
                    start: declaration.loc.start.line,
                    end: declaration.loc.end.line,
                  },
                  importSource: source,
                });
                break;
              }
            } else if (regex === ET_CETERA_IMPORT_GROUP_NAME) {
              continue;
            }
          } else {
            if (regex.test(source)) {
              importDeclarationGroups[i].push({
                range: {
                  start: declaration.loc.start.line,
                  end: declaration.loc.end.line,
                },
                importSource: source,
              });
              break;
            }
          }
        }
        if (i === regexList.length) {
          importDeclarationGroups[etCeteraIdx].push({
            range: {
              start: declaration.loc.start.line,
              end: declaration.loc.end.line,
            },
            importSource: source,
          });
        }
      }
      // Sort the import declarations within each group and convert to string
      // so that they can be concatenated with the rest of the file.
      const lines = text.split("\n");
      let imports: string;
      if (options.addEmptyLinesBetweenImportGroups) {
        imports = importDeclarationGroups
          .map((group) =>
            group
              .sort((a, b) => sortImport(a.importSource, b.importSource))
              .map(({ range }) =>
                lines.slice(range.start - 1, range.end).join("\n"),
              )
              .join("\n"),
          )
          .join("\n\n");
      } else {
        imports = importDeclarationGroups
          .map((group) =>
            group
              .sort((a, b) => sortImport(a.importSource, b.importSource))
              .map(({ range }) =>
                lines.slice(range.start - 1, range.end).join("\n"),
              )
              .join("\n"),
          )
          .join("\n");
      }
      // Calculate the line ranges of the import declarations in the original
      // file so that they can be removed. It's calculating the line ranges so
      // that consecusive import declarations will be combined into a singlej
      // range so that when the lines are removed from the original file, the
      // number of splices will be minimized.
      const firstImportDeclaration = body[importDeclarations[0].idx];
      const importLineRanges: LineRange[] = [
        {
          start: firstImportDeclaration.loc.start.line,
          end: firstImportDeclaration.loc.end.line,
        },
      ];
      for (let i = 1; i < importDeclarations.length; i++) {
        const importDecIndexA = importDeclarations[i - 1].idx;
        const importDecIndexB = importDeclarations[i].idx;
        if (importDecIndexA === importDecIndexB - 1) {
          const prevLineRange = importLineRanges[importLineRanges.length - 1];
          const importDecB = body[importDecIndexB];
          importLineRanges[importLineRanges.length - 1] = {
            start: prevLineRange.start,
            end: importDecB.loc.end.line,
          };
        } else {
          const importDecB = body[importDecIndexB];
          importLineRanges.push({
            start: importDecB.loc.start.line,
            end: importDecB.loc.end.line,
          });
        }
      }
      // Remove the import declarations from the original file by splicing out
      // the lines that correspond to the import declarations.
      for (const { start, end } of importLineRanges.reverse()) {
        lines.splice(start - 1, end - start + 1);
      }
      return imports + "\n" + lines.join("\n");
    },
  },
};
