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
