import { useTranslation } from "react-i18next";
import { TransactionForm } from "./TransactionForm";
import { useWorkspace } from "./useWorkspace";

export function TransactionsPage() {
  const { t } = useTranslation();
  const ws = useWorkspace().data;
  return (
    <section className="max-w-3xl space-y-5">
      <h1 className="text-3xl font-bold tracking-tight">{t("nav.transactions")}</h1>
      {ws && <TransactionForm workspaceId={ws.id} timeZone={ws.timezone} />}
    </section>
  );
}
