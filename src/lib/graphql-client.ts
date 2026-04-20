import { createClient, type Client } from "graphql-ws";
import { config } from "./config";

let wsClientSingleton: Client | null = null;

const getAuthToken = (): string | null => {
  const cookieToken = document.cookie
    .split("; ")
    .find((row) => row.startsWith("__session="))
    ?.split("=")[1];
  const localToken = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  return cookieToken || localToken || null;
};

export const getGraphqlWsClient = (): Client => {
  if (wsClientSingleton) return wsClientSingleton;
  wsClientSingleton = createClient({
    url: config.wsUrl,
    connectionParams: async () => {
      const token = getAuthToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
  });
  return wsClientSingleton;
};

export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const token = getAuthToken();
  
  const response = await fetch(config.graphqlUrl, {
    method: "POST",
    credentials: "include", // Include cookies for __session
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.errors?.[0]?.message || "Network response was not ok");
  }

  const result = await response.json();
  if (result.errors) throw new Error(result.errors[0].message);
  return result.data;
}


