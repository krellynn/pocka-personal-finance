import { useQuery } from "@tanstack/react-query";
import { fetchProfile } from "./api";
import { useAuth } from "./useAuth";

export const profileKey = (userId: string | undefined) => ["profile", userId] as const;

export function useProfile() {
  const userId = useAuth().session?.user.id;
  return useQuery({ queryKey: profileKey(userId), queryFn: () => fetchProfile(userId as string), enabled: !!userId });
}
