import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./AppShell";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { PlaceholderPage } from "../features/shared/PlaceholderPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { AccountsPage } from "../features/finance/AccountsPage";
import { PocketsPage } from "../features/finance/PocketsPage";
import { TransactionsPage } from "../features/finance/TransactionsPage";
import { ForgotPasswordPage, SignInPage, SignUpPage, UpdatePasswordPage } from "../features/auth/AuthPages";
import { GuestOnly, RequireAuth } from "../features/auth/guards";
export function App() { return <BrowserRouter><Routes><Route element={<GuestOnly/>}><Route path="sign-in" element={<SignInPage/>}/><Route path="sign-up" element={<SignUpPage/>}/><Route path="forgot-password" element={<ForgotPasswordPage/>}/></Route><Route path="update-password" element={<UpdatePasswordPage/>}/><Route element={<RequireAuth/>}><Route element={<AppShell/>}><Route index element={<DashboardPage/>}/><Route path="transactions" element={<TransactionsPage/>}/><Route path="accounts" element={<AccountsPage/>}/><Route path="pockets" element={<PocketsPage/>}/><Route path="budgets" element={<PlaceholderPage titleKey="nav.budgets"/>}/><Route path="goals" element={<PlaceholderPage titleKey="nav.goals"/>}/><Route path="debts" element={<PlaceholderPage titleKey="nav.debts"/>}/><Route path="reports" element={<PlaceholderPage titleKey="nav.reports"/>}/><Route path="settings" element={<SettingsPage/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Route></Route></Routes></BrowserRouter>; }