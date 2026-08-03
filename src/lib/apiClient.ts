export class ApiError extends Error {}

/**
 * Parses a fetch Response as JSON, raising a readable ApiError instead of
 * throwing a cryptic "Unexpected end of JSON input" when the server
 * returned an error with an empty/non-JSON body (e.g. an unhandled
 * exception, a rate limit, a proxy timeout).
 */
export async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    throw new ApiError(`服务器返回了无效响应（状态码 ${res.status}）。`);
  }
  if (!res.ok) {
    const message = (data as { error?: string } | undefined)?.error || `请求失败（状态码 ${res.status}）。`;
    throw new ApiError(message);
  }
  return data as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  return parseJsonResponse<T>(res);
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function apiDelete<T = { ok: true }>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

/** For non-JSON payloads, e.g. uploading a compiled PDF's raw bytes. */
export function apiPutBinary<T>(path: string, body: BodyInit, contentType: string): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
}
