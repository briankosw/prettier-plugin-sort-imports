import { BUILTIN_IMPORT_GROUP_NAME, ET_CETERA_IMPORT_GROUP_NAME } from './constants';

export function validateImportGroups(importGroups: string[] | undefined) {
  if (importGroups == null || importGroups.length === 0) {
    throw new Error(
      'Invalid `importGroups` passed in.',
    );
  }
  if (!importGroups.includes('*')) {
    throw new Error(
      "`importGroup must include '*' as one of the import groups.",
    );
  }
  const invalidRegexes: string[] = [];
  for (const importGroup of importGroups) {
    if (importGroup === BUILTIN_IMPORT_GROUP_NAME || importGroup === ET_CETERA_IMPORT_GROUP_NAME) {
      continue;
    }
    try {
      new RegExp(importGroup);
    } catch (e: unknown) {
      if (e instanceof SyntaxError) {
        invalidRegexes.push(importGroup);
      } else {
        throw e;
      }
    }
  }
  if (invalidRegexes.length > 0) {
    throw new SyntaxError(
      'Invalid regexes passed in as `importGroups`: ' + invalidRegexes.join(', ') + '.',
    )
  }
}

export function sortImport(a: string, b: string) {
  if (!a.includes("/") && !b.includes("/")) {
    return a.localeCompare(b);
  }
  const A = a.split("/");
  const B = b.split("/");
  let result: number = 0;
  for (let i = 0; i < Math.min(A.length, B.length); i++) {
    result = A[i].localeCompare(B[i]);
    if (result) break;
  }
  if (result !== 0) {
    return result;
  }
  if (result === 0 && A.length !== B.length) {
    return A.length < B.length ? -1 : 1;
  }
  return 0;
}
