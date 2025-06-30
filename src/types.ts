import { ParserOptions } from "prettier";

export interface Options extends ParserOptions {
  addEmptyLinesBetweenImportGroups?: boolean;
  importGroups?: string[];
}

export type LineRange = {
  readonly start: number;
  readonly end: number;
};

export type ImportSource = string;
