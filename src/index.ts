import {
  parse,
  AST_NODE_TYPES,
  TSESTree,
} from "@typescript-eslint/typescript-estree";
import isBuiltinModule from "is-builtin-module";
import { Plugin } from "prettier/index";
import { parsers as typescriptParsers } from "prettier/plugins/typescript";

import {
  BUILTIN_IMPORT_GROUP_NAME,
  DISABLE_PRAGMA,
  ET_CETERA_IMPORT_GROUP_NAME,
} from "./constants";
import { Options } from "./types";
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
    ...typescriptParsers.typescript,
    preprocess: (text: string, options: Options): string => {
      if (typescriptParsers.typescript.preprocess) {
        text = typescriptParsers.typescript.preprocess(text, options);
      }
      // Skip sorting imports if the `DISABLE_PRAGMA` is present.
      if (text.includes(DISABLE_PRAGMA)) {
        return text;
      }
      if (options.importGroups == null) {
        return text;
      }

      validateImportGroups(options.importGroups);

      const ast = parse(text, {
        ...options,
        loc: true,
        range: true,
        comment: true,
      });

      const body = ast.body;
      // Grab all the import declarations
      const importDeclarations = body.filter(
        (statement): statement is TSESTree.ImportDeclaration => {
          return statement.type === AST_NODE_TYPES.ImportDeclaration;
        },
      );
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
        (): Array<{
          declaration: TSESTree.ImportDeclaration;
          leadingComments: TSESTree.Comment[];
        }> => [],
      );

      let availableComments = [...ast.comments];
      function commentEndingAtLine(line: number): TSESTree.Comment | undefined {
        const commentIdx = availableComments.findIndex(
          (comment) => comment.loc.end.line + 1 === line,
        );
        if (commentIdx !== -1) {
          const comment = availableComments[commentIdx];
          availableComments.splice(commentIdx, 1);
          return comment;
        }
        return undefined;
      }
      function commentsEndingAtLine(line: number): TSESTree.Comment[] {
        let comments = [];
        let searchLine: number | undefined = line;
        do {
          const comment = commentEndingAtLine(searchLine);
          if (comment) {
            comments.push(comment);
          }
          searchLine = comment?.loc.start.line;
        } while (searchLine != null);
        return comments.reverse();
      }

      for (const declaration of importDeclarations) {
        const leadingComments = commentsEndingAtLine(
          declaration.loc.start.line,
        );
        const source = declaration.source.value;
        const sourceModule = source.split("/", 1)[0];
        let i = 0;
        for (; i < regexList.length; i++) {
          const regex = regexList[i];
          if (typeof regex === "string") {
            if (regex === BUILTIN_IMPORT_GROUP_NAME) {
              if (isBuiltinModule(sourceModule)) {
                importDeclarationGroups[i].push({
                  declaration,
                  leadingComments,
                });
                break;
              }
            } else if (regex === ET_CETERA_IMPORT_GROUP_NAME) {
              continue;
            }
          } else {
            if (regex.test(source)) {
              importDeclarationGroups[i].push({ declaration, leadingComments });
              break;
            }
          }
        }
        if (i === regexList.length) {
          importDeclarationGroups[etCeteraIdx].push({
            declaration,
            leadingComments,
          });
        }
      }

      // Sort the import declarations within each group and format them
      const rangesToDelete: Array<[number, number]> = [];
      const importText = importDeclarationGroups
        .map((group) => {
          group.sort((a, b) =>
            sortImport(a.declaration.source.value, b.declaration.source.value),
          );
          const sectionText = group.map(({ declaration, leadingComments }) => {
            // Grab the leading comments if there are any
            const start =
              leadingComments.at(0)?.range[0] ?? declaration.range[0];
            const end = declaration.range[1];
            // Keep track of the ranges so we can omit them when copying the original text
            rangesToDelete.push([start, end]);
            return text.slice(start, end);
          });
          return sectionText.join("\n");
        })
        .join("\n\n");

      // Sort the ranges and then use them to copy the rest of the text
      rangesToDelete.sort((a, b) => a[0] - b[0]);

      // If there is leading text, add it _before_ the imports
      let newText: string;
      let i: number;
      if (rangesToDelete[0][0] !== 0) {
        newText = text.slice(0, rangesToDelete[0][0]);
        i = rangesToDelete[0][0];
      } else {
        newText = "";
        i = 0;
      }

      newText += importText;
      newText += "\n\n";

      // Add the rest of the text after the imports
      for (const [start, end] of rangesToDelete) {
        if (i < start) {
          newText += text.slice(i, start);
        }
        i = end;
      }
      // Copy the remaining text after the last import declaration
      newText += text.slice(i);

      return newText;
    },
  },
};
