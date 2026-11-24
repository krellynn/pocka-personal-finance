import { ArrowLeftRight, ArrowUpRight, ChartNoAxesCombined, Goal, LayoutDashboard, Wallet, WalletCards } from "lucide-react";

export const links = [
  { to: "/", key: "nav.dashboard", icon: LayoutDashboard },
  { to: "/transactions", key: "nav.transactions", icon: ArrowLeftRight },
  { to: "/accounts", key: "nav.accounts", icon: Wallet },
  { to: "/pockets", key: "nav.pockets", icon: WalletCards },
  { to: "/budgets", key: "nav.budgets", icon: ChartNoAxesCombined },
  { to: "/goals", key: "nav.goals", icon: Goal },
  { to: "/debts", key: "nav.debts", icon: ArrowUpRight },
  { to: "/reports", key: "nav.reports", icon: ChartNoAxesCombined },
];

/** The phone bottom bar shows the first four; the rest are listed on the settings page. */
export const mobileBarCount = 4;
