/**
 * Room code generation utilities
 */

// Characters that are easy to read and type (avoiding ambiguous ones like 0/O, 1/I/L)
const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const DEFAULT_CODE_LENGTH = 6

/**
 * Generate a random room code
 */
export function generateRoomCode(length: number = DEFAULT_CODE_LENGTH, prefix?: string): string {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
  }
  return prefix ? `${prefix}-${code}` : code
}

/**
 * Validate a room code format
 */
export function isValidRoomCode(code: string): boolean {
  // Allow codes with or without prefix
  const pattern = /^([A-Z]+-)?[A-HJKMNP-Z2-9]{4,8}$/
  return pattern.test(code.toUpperCase())
}

/**
 * Normalize a room code (uppercase, trim)
 */
export function normalizeRoomCode(code: string): string {
  return code.toUpperCase().trim()
}

/**
 * Generate a room join URL
 */
export function generateJoinUrl(baseUrl: string, roomCode: string): string {
  const normalizedCode = normalizeRoomCode(roomCode)
  const cleanBaseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
  return `${cleanBaseUrl}/${normalizedCode}`
}

/**
 * Extract room code from a join URL
 */
export function extractRoomCodeFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/').filter(Boolean)
    const lastPart = pathParts[pathParts.length - 1]

    if (lastPart && isValidRoomCode(lastPart)) {
      return normalizeRoomCode(lastPart)
    }
    return null
  } catch {
    // If not a valid URL, check if it's just a room code
    if (isValidRoomCode(url)) {
      return normalizeRoomCode(url)
    }
    return null
  }
}
