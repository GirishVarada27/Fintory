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
import RequireAuth from "./components/RequireAuth";
import NavBar from "./components/NavBar";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
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
        </Routes>
      </main>
    </div>
  );
}
