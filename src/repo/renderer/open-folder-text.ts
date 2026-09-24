import type { OpenFolderError } from './open-folder'

type ErrorByCode = { [E in OpenFolderError as E['code']]: E }

type ErrorCode = keyof ErrorByCode

const ERROR_TEXT: { [C in ErrorCode]: (error: ErrorByCode[C]) => string } = {
  // Offering `git init` here is #29.
  NOT_A_REPO: ({ path }) => `${path} is not a git repository.`,
  PATH_NOT_FOUND: ({ path }) => `${path} is not a folder that can be opened.`,
  WSL_UNSUPPORTED: ({ path }) => `${path} is inside WSL, which IReview does not support.`,
  GIT_MISSING: () => 'git was not found, so the folder could not be checked.',
  GIT_FAILED: ({ stderr }) => `git could not check the folder: ${stderr.trim()}`,
  CALL_FAILED: ({ call, errorCode }) => `Opening the folder failed at ${call} (${errorCode}).`,
}

/** Why Open Folder opened nothing, as the Welcome Window says it. */
export function openFolderErrorText<C extends ErrorCode>(error: ErrorByCode[C] & { code: C }): string {
  const toText: (error: ErrorByCode[C]) => string = ERROR_TEXT[error.code]
  return toText(error)
}
