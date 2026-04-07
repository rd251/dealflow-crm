import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
  user_id: string;
  display_name: string;
  email: string;
  avatar_url?: string;
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = useCallback(() => {
    supabase
      .from("profiles")
      .select("user_id, display_name, email, avatar_url")
      .then(({ data }) => {
        setProfiles((data as UserProfile[]) || []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchProfiles();

    const channel = supabase
      .channel("profiles-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => fetchProfiles()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProfiles]);

  return { profiles, loading, refetch: fetchProfiles };
}
