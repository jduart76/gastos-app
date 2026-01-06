const API_BASE = (import.meta as any).env?.VITE_API_BASE || "http://localhost:8000";

export function getToken(): string | null {
  return localStorage.getItem("token");
}
export function setToken(t: string) {
  localStorage.setItem("token", t);
}
export function clearToken() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

async function req(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as any),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `HTTP ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

export const api = {
  login: (name: string, pin: string) =>
    req(`/api/auth/login?name=${encodeURIComponent(name)}&pin=${encodeURIComponent(pin)}`, { method: "POST" }),

  me: () => req("/api/me"),

  dashboard: (month: string) => req(`/api/dashboard?month=${encodeURIComponent(month)}`),

  purchases: () => req("/api/purchases"),
  purchaseDetail: (id: number) => req(`/api/purchases/${id}`),

  createPurchase: (p: any) => req("/api/purchases", { method: "POST", body: JSON.stringify(p) }),
  updatePurchase: (id: number, p: any) => req(`/api/purchases/${id}`, { method: "PUT", body: JSON.stringify(p) }),

  addPayment: (p: any) => req("/api/payments", { method: "POST", body: JSON.stringify(p) }),
  updatePayment: (id: number, p: any) => req(`/api/payments/${id}`, { method: "PUT", body: JSON.stringify(p) }),
  deletePayment: (id: number) => req(`/api/payments/${id}`, { method: "DELETE" })
};
