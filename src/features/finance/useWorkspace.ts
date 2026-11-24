import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { fetchWorkspace } from "./api";
import { financeKeys } from "./keys";

export function useWorkspace() {
  const userId = useAuth().session?.user.id;
  return useQuery({ queryKey: financeKeys.workspace(userId), queryFn: () => fetchWorkspace(userId as string), enabled: !!userId });
}
