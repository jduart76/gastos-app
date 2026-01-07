import React from "react";
import ReactDOM from "react-dom/client";
import "./app.css";
import { clearToken, getToken } from "./api";
import { TopBar } from "./components/TopBar";
import { Login } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { PurchasesPage } from "./pages/Purchases";
import { PurchaseDetailPage } from "./pages/PurchaseDetail";
import { ProfilePage } from "./pages/Profile";

type Page = "login" | "dashboard" | "purchases" | "detail" | "profile";

function App() {
  const [user, setUser] = React.useState<string | null>(() => localStorage.getItem("user"));
  const [page, setPage] = React.useState<Page>(() => (getToken() ? "dashboard" : "login"));
  const [detailId, setDetailId] = React.useState<number | null>(null);

  function logout() {
    clearToken();
    localStorage.removeItem("user");
    setUser(null);
    setDetailId(null);
    setPage("login");
  }

  return (
    <>
      {page !== "login" ? (
        <TopBar
          user={user}
          onNav={(p) => setPage(p as Page)} // ahora sí navega a "profile"
          onLogout={logout}
        />
      ) : null}

      {page === "login" ? (
        <Login
          onDone={(u) => {
            localStorage.setItem("user", u);
            setUser(u);
            setPage("dashboard");
          }}
        />
      ) : page === "profile" ? (
        <ProfilePage
          user={user ?? "User"}
          onBack={() => setPage("dashboard")}
          onLogout={logout}
          onUserUpdated={(u: string) => {
            localStorage.setItem("user", u);
            setUser(u);
          }}
        />
      ) : page === "dashboard" ? (
        <DashboardPage />
      ) : page === "purchases" ? (
        <PurchasesPage
          onOpenPurchase={(id) => {
            setDetailId(id);
            setPage("detail");
          }}
        />
      ) : (
        <PurchaseDetailPage
          id={detailId ?? 0}
          onBack={() => setPage("purchases")}
        />
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
