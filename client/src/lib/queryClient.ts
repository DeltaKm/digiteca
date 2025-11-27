import { QueryClient, QueryFunction } from "@tanstack/react-query";

// CSRF token cache
let cachedCsrfToken: string | null = null;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch("/api/csrf-token", {
    credentials: "include",
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch CSRF token: ${res.status}`);
  }
  
  const data = await res.json();
  return data.csrfToken;
}

async function getCsrfToken(): Promise<string> {
  if (!cachedCsrfToken) {
    cachedCsrfToken = await fetchCsrfToken();
  }
  return cachedCsrfToken;
}

function clearCsrfTokenCache(): void {
  cachedCsrfToken = null;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const needsCsrfToken = ["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase());
  
  let headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Add CSRF token for state-changing requests
  if (needsCsrfToken) {
    try {
      const csrfToken = await getCsrfToken();
      headers["x-csrf-token"] = csrfToken;
    } catch (error) {
      console.warn("Failed to get CSRF token:", error);
      // Continue without CSRF token - let the server handle the error
    }
  }

  let res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Handle CSRF token errors - retry once with fresh token
  if (!res.ok && res.status === 403 && needsCsrfToken) {
    const errorText = await res.text();
    if (errorText.includes("EBADCSRFTOKEN") || errorText.includes("invalid csrf token")) {
      try {
        // Clear cached token and get fresh one
        clearCsrfTokenCache();
        const freshCsrfToken = await getCsrfToken();
        headers["x-csrf-token"] = freshCsrfToken;
        
        // Retry the request with fresh token
        res = await fetch(url, {
          method,
          headers,
          body: data ? JSON.stringify(data) : undefined,
          credentials: "include",
        });
      } catch (retryError) {
        console.warn("Failed to retry with fresh CSRF token:", retryError);
        // Continue with original response
      }
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
