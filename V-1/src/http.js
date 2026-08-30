export class HttpError extends Error {
  constructor(message, response) {
    super(message);
    this.name = 'HttpError';
    this.status = response?.status;
    this.statusText = response?.statusText;
  }
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url, options = {}, timeoutMs = 30000) {
  const response = await fetchWithTimeout(url, options, timeoutMs);
  if (!response.ok) {
    throw new HttpError(`Request failed with ${response.status}`, response);
  }
  return response.json();
}

export async function fetchBuffer(url, options = {}, timeoutMs = 30000) {
  const response = await fetchWithTimeout(url, options, timeoutMs);
  if (!response.ok) {
    throw new HttpError(`Request failed with ${response.status}`, response);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    response
  };
}
