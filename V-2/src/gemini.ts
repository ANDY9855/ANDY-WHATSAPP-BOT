/**
 * Shared Gemini API Helper: Key rotation and dynamic model discovery
 */

export function getGeminiKeys(): string[] {
  const matchingEnvNames = Object.keys(process.env).filter(k => /^GEMINI_API_KEY(_\d+)?$/i.test(k))
  const envKeys = matchingEnvNames.map(k => process.env[k])
  const rawList = envKeys.flatMap(k => (k ? k.split(',') : [])).map(k => k.trim()).filter(Boolean)
  return Array.from(new Set(rawList))
}

let cachedFlashModels: string[] | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour TTL

export async function getAvailableFlashModels(overrideKey?: string): Promise<string[]> {
  const now = Date.now()
  if (cachedFlashModels && cachedFlashModels.length > 0 && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedFlashModels
  }

  const keys = getGeminiKeys()
  const apiKey = overrideKey || keys[0]

  const fallback = ['gemini-3.6-flash']

  if (!apiKey) {
    console.warn('[Gemini Models] No GEMINI_API_KEY configured. Falling back to default:', fallback)
    cachedFlashModels = fallback
    cacheTimestamp = now
    return fallback
  }

  try {
    console.log('[Gemini Models] Fetching active models from Gemini ListModels API...')
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      console.warn(`[Gemini Models] ListModels HTTP ${response.status}. Falling back to default:`, fallback)
      cachedFlashModels = fallback
      cacheTimestamp = now
      return fallback
    }

    const data: any = await response.json()
    if (!Array.isArray(data.models) || data.models.length === 0) {
      console.warn('[Gemini Models] ListModels returned empty list. Falling back to default:', fallback)
      cachedFlashModels = fallback
      cacheTimestamp = now
      return fallback
    }

    // Filter models supporting generateContent and containing "flash" in name/displayName
    const flashModels: string[] = data.models
      .filter((m: any) => {
        const methods: string[] = m.supportedGenerationMethods ?? []
        const name: string = (m.name || '').toLowerCase()
        const isGenerateContent = methods.includes('generateContent')
        const isFlash = name.includes('flash')
        // Exclude specialized non-text/chat variants like image-only, tts-only, or robotics
        const isSpecialized = /-image|-tts|-computer-use|-robotics/i.test(name)
        return isGenerateContent && isFlash && !isSpecialized
      })
      .map((m: any) => m.name.replace(/^models\//, ''))

    // Sort to prioritize gemini-3.6-flash, gemini-3.5-flash, gemini-2.5-flash
    const uniqueModels = Array.from(new Set(flashModels))

    if (uniqueModels.length === 0) {
      console.warn('[Gemini Models] No suitable Flash models matched filter. Falling back to default:', fallback)
      cachedFlashModels = fallback
      cacheTimestamp = now
      return fallback
    }

    // Always ensure gemini-3.6-flash is in the list if missing
    if (!uniqueModels.includes('gemini-3.6-flash')) {
      uniqueModels.unshift('gemini-3.6-flash')
    } else {
      // Put gemini-3.6-flash first
      uniqueModels.sort((a, b) => (a === 'gemini-3.6-flash' ? -1 : b === 'gemini-3.6-flash' ? 1 : 0))
    }

    cachedFlashModels = uniqueModels
    cacheTimestamp = now

    console.log(`[Gemini Models] Resolved active Flash models (${cachedFlashModels.length}):`, JSON.stringify(cachedFlashModels))
    return cachedFlashModels
  } catch (err: any) {
    console.warn('[Gemini Models] ListModels request failed:', err.message, '. Falling back to default:', fallback)
    cachedFlashModels = fallback
    cacheTimestamp = now
    return fallback
  }
}
