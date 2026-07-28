import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import Loans from "./pages/Loans";
import SavingsAccounts from "./pages/SavingsAccounts";
import Assets from "./pages/Assets";
import Budgets from "./pages/Budgets";
import RecurringExpenses from "./pages/RecurringExpenses";
import LinkedAccounts from "./pages/LinkedAccounts";
import AccountSettings from "./pages/AccountSettings";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import RequireAuth from "./components/RequireAuth";
import NavBar from "./components/NavBar";
import { Link } from "react-router-dom";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <NavBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/expenses"
            element={
              <RequireAuth>
                <Expenses />
              </RequireAuth>
            }
          />
          <Route
            path="/loans"
            element={
              <RequireAuth>
                <Loans />
              </RequireAuth>
            }
          />
          <Route
            path="/savings"
            element={
              <RequireAuth>
                <SavingsAccounts />
              </RequireAuth>
            }
          />
          <Route
            path="/assets"
            element={
              <RequireAuth>
                <Assets />
              </RequireAuth>
            }
          />
          <Route
            path="/budgets"
            element={
              <RequireAuth>
                <Budgets />
              </RequireAuth>
            }
          />
          <Route
            path="/recurring"
            element={
              <RequireAuth>
                <RecurringExpenses />
              </RequireAuth>
            }
          />
          <Route
            path="/linked-accounts"
            element={
              <RequireAuth>
                <LinkedAccounts />
              </RequireAuth>
            }
          />
          <Route
            path="/account"
            element={
              <RequireAuth>
                <AccountSettings />
              </RequireAuth>
            }
          />
        </Routes>
      </main>
      <footer className="border-t border-white/10 py-4 text-center text-xs text-slate-500">
        <Link to="/privacy" className="hover:text-slate-300">
          Privacy Policy
        </Link>
        {" · "}
        <Link to="/terms" className="hover:text-slate-300">
          Terms of Service
        </Link>
      </footer>
    </div>
  );
}
