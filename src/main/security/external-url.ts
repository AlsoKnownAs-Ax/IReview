/** Whether a URL may be handed to the OS browser: well-formed https without embedded credentials (SPEC §5.1). */
export function isAllowedExternalUrl(url: string): boolean {
  const parsed = URL.parse(url)
  return parsed?.protocol === 'https:' && parsed.username === '' && parsed.password === ''
}
