// Always same-origin, relative to whatever domain this app is served from --
// next.config.ts rewrites /api/* to the real API so the browser never talks
// to it cross-site (see the comment there for why that matters on mobile).
const API_URL = "/api";
export const apiUrl = API_URL;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public issues?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

async function parseErrorMessage(res: Response): Promise<{ message: string; issues?: { path: string; message: string }[] }> {
  try {
    const body = (await res.json()) as { statusCode?: number; message?: string | string[]; issues?: { path: string; message: string }[] };
    // Every error our own NestJS API sends is shaped {statusCode, message, ...}
    // (Nest's default HttpException format). A JSON body without statusCode
    // didn't come from our API at all -- it's an infrastructure error page
    // (e.g. the host the API runs on being down) that happens to also be
    // JSON with its own unrelated `message` field. Showing that text
    // directly to a customer leaks internal details and means nothing to
    // them, so it gets the same generic fallback as an unparseable body.
    if (typeof body.statusCode !== "number") {
      return { message: "Something went wrong. Please try again." };
    }
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    return { message: message ?? "Something went wrong. Please try again.", issues: body.issues };
  } catch {
    return { message: "Something went wrong. Please try again." };
  }
}

async function request<T>(path: string, options: RequestInit, retry = true): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers:
      options.body instanceof FormData
        ? options.headers
        : { "Content-Type": "application/json", ...options.headers },
  });

  if (res.status === 401 && retry && path !== "/auth/refresh") {
    const refreshed = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
    if (refreshed.ok) return request<T>(path, options, false);
  }

  if (!res.ok) {
    const { message, issues } = await parseErrorMessage(res);
    throw new ApiError(message, res.status, issues);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined }),
  postForm: <T>(path: string, form: FormData) => request<T>(path, { method: "POST", body: form }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
