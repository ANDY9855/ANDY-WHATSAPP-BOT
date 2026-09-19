import axios, { AxiosRequestConfig } from 'axios'

const base = () => process.env.API_BASE_URL ?? 'http://127.0.0.1:3000'
const timeout = () => Number(process.env.API_TIMEOUT_MS ?? 45_000)

async function request<T = unknown>(path: string, config: AxiosRequestConfig = {}) {
  const response = await axios.request<T>({ url: `${base()}${path}`, timeout: timeout(), validateStatus: s => s < 500, ...config })
  if (response.status >= 400) throw new Error(`API ${path} returned HTTP ${response.status}`)
  return response
}

export async function getJson(path: string, params: Record<string, string | number | undefined> = {}) {
  try {
    return (await request(path, { method: 'GET', params })).data
  } catch (err: any) {
    return { success: false, error: `Service endpoint ${path} unavailable (${err.message}). Check local server config.` }
  }
}

export async function getBinary(path: string, params: Record<string, string | number | undefined> = {}) {
  const response = await request<ArrayBuffer>(path, { method: 'GET', params, responseType: 'arraybuffer' })
  return { data: Buffer.from(response.data), contentType: String(response.headers['content-type'] ?? 'application/octet-stream') }
}

export async function postJson<T = unknown>(path: string, data: unknown) {
  try {
    return (await request<T>(path, { method: 'POST', data })).data
  } catch (err: any) {
    return { success: false, error: `Service endpoint ${path} unavailable (${err.message}). Check local server config.` } as T
  }
}

export async function postBinary(path: string, data: unknown) {
  const response = await request<ArrayBuffer>(path, { method: 'POST', data, responseType: 'arraybuffer' })
  return { data: Buffer.from(response.data), contentType: String(response.headers['content-type'] ?? 'application/octet-stream') }
}

export const tts = (text: string, voiceIndex = 314, pitch = 0, rate = 0) => postBinary(process.env.API_TTS_PATH ?? '/api/tts', { voiceIndex, text: text.slice(0, 1950), pitch, rate })
export const voices = () => getJson('/api/voices')

export const downloader = async (url: string) => {
  try {
    return (await request(process.env.API_DOWNLOAD_PATH ?? '/api/alldl', { method: 'GET', params: { url } })).data
  } catch {
    return { success: false, error: `Universal Downloader backend service is not running on ${base()}. Requires yt-dlp/downloader backend service.` }
  }
}

export const screenshot = async (url: string) => {
  try {
    return await getBinary(process.env.API_SCREENSHOT_PATH ?? '/api/websnap', { action: 'screenshot', url })
  } catch {
    throw new Error(`Screenshot service unavailable. Requires WebSnap backend running on ${base()}.`)
  }
}

export const websnapInfo = async (url: string) => {
  try {
    return (await request('/api/websnap', { method: 'GET', params: { action: 'info', url } })).data
  } catch {
    return { success: false, error: `WebSnap backend service is not running on ${base()}.` }
  }
}

export type ImageGenerateResult = { success?: boolean; imageUrl?: string; prompt?: string; ratio?: string; error?: string }
export type VideoGenerateResult = { success?: boolean; videoUrl?: string; prompt?: string; ratio?: string; error?: string }

export const imageGenerate = async (prompt: string, ratio = '1:1'): Promise<ImageGenerateResult> => {
  try {
    const res = await request<ImageGenerateResult>('/api/tti', { method: 'POST', data: { prompt, ratio } })
    return res.data
  } catch {
    // Fallback: Pollinations AI public image generator
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`
    return { success: true, imageUrl, prompt }
  }
}

export const videoGenerate = (prompt: string, imageBase64: string, ratio = 'auto', duration = 10) => postJson<VideoGenerateResult>('/api/ptv', { prompt, imageBase64, ratio, duration })
export const imageChat = (imageUrl: string, userPrompt: string) => postJson('/api/imgchat', { url: imageUrl, userPrompt })

export const tempMail = async (action: string, value?: string) => {
  try {
    const res = await request('/api/mail', { method: 'GET', params: { action, name: value, mail: value } })
    return res.data
  } catch {
    // Fallback: 1secmail public API
    if (action === 'create') {
      const login = value || `user${Math.floor(Math.random() * 89999 + 10000)}`
      const domain = '1secmail.com'
      return { success: true, email: `${login}@${domain}`, note: 'Generated via 1secmail fallback' }
    } else if (action === 'inbox' && value) {
      const [login, domain] = value.split('@')
      if (!login || !domain) return { success: false, error: 'Provide full email address, e.g. .mail inbox user@1secmail.com' }
      const res = await axios.get(`https://www.1secmail.com/api/v1/?action=getMessages&login=${encodeURIComponent(login)}&domain=${encodeURIComponent(domain)}`)
      return { success: true, messages: res.data }
    }
    return { success: false, error: 'Supported tempMail fallback actions: create, inbox <email>' }
  }
}

export const medicineSearch = (q: string) => getJson('/api/search', { q })
export const medicineDetails = (id: string) => getJson('/api/details', { id })
export const transcribe = (audio: unknown) => postJson('/api/transcribe', audio)
export const manga = (action: string, q?: string, id?: string) => getJson('/api/manga', { action, q, id })
export const novel = (action: string, q?: string, novelId?: string, fileUrl?: string) => getJson('/api/novel', { action, q, novelId, fileUrl })
export const urduNovel = (action: string, q?: string, url?: string) => getJson('/api/unovel', { action, q, url })
export const movieSearch = (q: string) => getJson('/api/msearch', { q })

export const wikipediaPdf = async (query: string) => {
  try {
    return await getBinary('/api/wikipdf', { query })
  } catch {
    throw new Error(`WIKIPDF_FALLBACK:${query}`)
  }
}

export async function wikipediaSummary(query: string) {
  try {
    const res = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`)
    return { title: res.data.title, extract: res.data.extract, url: res.data.content_urls?.desktop?.page }
  } catch {
    return { error: `No Wikipedia article found for "${query}".` }
  }
}

export const websiteZip = (url: string) => postBinary('/api/zip', { url })
export const certificate = (data: unknown) => postBinary('/api/certificate', data)
export const certificateTemplates = () => getJson('/api/certificate', { action: 'templates' })
export const handwriting = (text: string, font?: string, color?: string) => getBinary('/api/hand', { text, font, color })
export const telenorQuiz = () => getJson('/api/telenor', { format: 'answers' })
export const n8n = (endpoint: string, params: Record<string, string | number> = {}) => getJson('/api/n8n', { endpoint, ...params })

export const courses = async (q: string) => {
  try {
    const res = await request('/api/courses', { method: 'GET', params: { q } })
    return res.data
  } catch {
    const curated = [
      { id: 1, name: 'Free Web Development Fundamentals (HTML, CSS, JS)', url: 'https://freecodecamp.org' },
      { id: 2, name: 'Python for Beginners & Data Science', url: 'https://python.org' },
      { id: 3, name: 'AI & Machine Learning Crash Course', url: 'https://coursera.org' },
      { id: 4, name: 'DevOps & Cloud Engineering Bootcamp', url: 'https://roadmap.sh/devops' }
    ]
    const filtered = q ? curated.filter(c => c.name.toLowerCase().includes(q.toLowerCase())) : curated
    return { success: true, title: 'Free Tech Courses Catalog', total: filtered.length, courses: filtered }
  }
}

export const driveup = (params: Record<string, string | number>) => getJson('/api/driveup', params)

export function isValidHttpUrl(value: string) {
  try { const u = new URL(value); return u.protocol === 'http:' || u.protocol === 'https:' } catch { return false }
}