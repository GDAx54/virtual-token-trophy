import { useEffect, useState } from "react";

const KEY = "tokenbet:active-league";
const EVT = "tokenbet:league-change";

export function getActiveLeagueId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setActiveLeagueId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(KEY, id);
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVT));
}

export function useActiveLeague() {
  const [leagueId, setState] = useState<string | null>(null);
  useEffect(() => {
    setState(getActiveLeagueId());
    const sync = () => setState(getActiveLeagueId());
    window.addEventListener("storage", sync);
    window.addEventListener(EVT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(EVT, sync);
    };
  }, []);
  return {
    leagueId,
    setLeague: (id: string | null) => {
      setActiveLeagueId(id);
      setState(id);
    },
  };
}
