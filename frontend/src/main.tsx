import React from "react";
import ReactDOM from "react-dom/client";
import "./app.css";
import { clearToken, getToken } from "./api";
import { TopBar } from "./components/TopBar";
import { Login } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { PurchasesPage } from "./pages/Purchases";
import { PurchaseDetailPage } from "./pages/PurchaseDetail";

function App() {
  const [user, setUser] = React.useState<string | null>(localStorage.getItem("user"));
  const [page, setPage] = React.useState<"login"|"dashboard"|"purchases"|"detail">(
    getToken() ? "dashboard" : "login"
  );
  const [detailId, setDetailId] = React.useState<number | null>(null);

  function logout() {
    clearToken();
    setUser(null);
    setPage("login");
  }

  return (
    <>
      {page !== "login" ? (
        <TopBar
            user={user}
            onNav={(p)=>{
                if (p === "profile") setPage("dashboard"); // temporal
                else setPage(p as any);
            }}
  onLogout={logout}
/>
      ) : null}

      {page === "login" ? (
        <Login onDone={(u)=>{ setUser(u); setPage("dashboard"); }} />
      ) : page === "dashboard" ? (
        <DashboardPage />
      ) : page === "purchases" ? (
        <PurchasesPage onOpenPurchase={(id)=>{ setDetailId(id); setPage("detail"); }} />
      ) : (
        <PurchaseDetailPage id={detailId!} onBack={()=>setPage("purchases")} />
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
