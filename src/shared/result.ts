/** A value or a coded error, never both (the user's TypeScript conventions). */
export type Result<T, E> = { data: T; error: null } | { data: null; error: E }
