/** Whether a URL may be handed to the OS browser: well-formed https without embedded credentials (SPEC §5.1). */
export function isAllowedExternalUrl(url: string): boolean {
  if (!URL.canParse(url)) return false
  const { protocol, hostname, username, password } = new URL(url)
  return protocol === 'https:' && hostname !== '' && username === '' && password === ''
}
