const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
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
    const body = (await res.json()) as { message?: string | string[]; issues?: { path: string; message: string }[] };
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

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  postForm: <T>(path: string, form: FormData) => request<T>(path, { method: "POST", body: form }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
