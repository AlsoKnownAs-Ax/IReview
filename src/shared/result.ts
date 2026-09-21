/** A value or a coded error, never both. */
export type Result<T, E> = { data: T; error: null } | { data: null; error: E }
