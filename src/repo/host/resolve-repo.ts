import { realpath, stat } from 'node:fs/promises'
import { readRepoPaths } from '@/git'
import type { ResolvedRepo, ResolveRepoError, ResolveRepoInput } from '@/repo/contract'
import type { Result } from '@/shared/result'

// `\\wsl$\<distro>` and `\\wsl.localhost\<distro>`, optionally as `\\?\UNC\…`, either slash style, any case (SPEC §3.1).
const WSL_PATH = /^[\\/]{2}([?.][\\/]UNC[\\/])?wsl(\$|\.localhost)([\\/]|$)/i

export async function resolveRepo({ path }: ResolveRepoInput): Promise<Result<ResolvedRepo, ResolveRepoError>> {
  if (isWslPath(path)) {
    return { data: null, error: { code: 'WSL_UNSUPPORTED', path } }
  }

  // Checked before git: a missing `cwd` would otherwise report `GIT_MISSING`.
  if (!(await isFolder(path))) {
    return { data: null, error: { code: 'PATH_NOT_FOUND', path } }
  }

  const { data: paths, error } = await readRepoPaths({ cwd: path })

  if (error) {
    return { data: null, error }
  }

  // Real paths resolve symlinks and Windows 8.3 short names, so the same Repo always compares equal.
  const [identity, checkoutRoot] = await Promise.all([paths.commonDir, paths.checkoutRoot].map(realPathOf))

  // Absent only if the folder vanished while git ran.
  if (!identity || !checkoutRoot) {
    return { data: null, error: { code: 'PATH_NOT_FOUND', path } }
  }

  return { data: { identity, checkoutRoot }, error: null }
}

export function isWslPath(path: string): boolean {
  return WSL_PATH.test(path)
}

function isFolder(path: string): Promise<boolean> {
  return stat(path).then(
    (stats): boolean => stats.isDirectory(),
    (): boolean => false,
  )
}

/** `realpath('')` resolves to the process's own cwd, so an empty path is absent instead. */
async function realPathOf(path: string): Promise<string | undefined> {
  if (!path) {
    return undefined
  }

  return realpath(path).catch((): undefined => undefined)
}
