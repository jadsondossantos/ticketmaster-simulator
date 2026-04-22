export type ApiError = {
  error?: string;
  message?: string;
  statusCode?: number;
  issues?: Array<{ path: Array<string | number>; message: string }>;
};

export function createAdminClient(adminKey: string) {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(path, {
      method,
      headers: {
        "content-type": "application/json",
        "x-admin-key": adminKey,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await res.text();
    const data = text ? (JSON.parse(text) as unknown) : null;

    if (!res.ok) {
      const err = (data && typeof data === "object" ? (data as ApiError) : {}) as ApiError;
      const msg = err.error || err.message || `HTTP ${res.status}`;
      const details = err.issues?.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
      throw new Error(details ? `${msg}\n${details}` : msg);
    }
    return data as T;
  }

  return {
    get: <T,>(path: string) => request<T>("GET", path),
    post: <T,>(path: string, body: unknown) => request<T>("POST", path, body),
    patch: <T,>(path: string, body: unknown) => request<T>("PATCH", path, body),
    del: <T,>(path: string) => request<T>("DELETE", path),
  };
}

