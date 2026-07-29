import { createContext, useContext, useState, type ReactNode } from "react";
import { setViewingAsOwnerId, getViewingAsOwnerId } from "../api/client";

interface ViewingAsState {
  ownerId: string | null;
  ownerName: string | null;
}

interface ViewingAsContextValue extends ViewingAsState {
  startViewingAs: (ownerId: string, ownerName: string) => void;
  stopViewingAs: () => void;
}

const STORAGE_NAME_KEY = "fintory.viewingAsOwnerName";

const ViewingAsContext = createContext<ViewingAsContextValue | null>(null);

export function ViewingAsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ViewingAsState>(() => ({
    ownerId: getViewingAsOwnerId(),
    ownerName: typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_NAME_KEY) : null,
  }));

  function startViewingAs(ownerId: string, ownerName: string) {
    setViewingAsOwnerId(ownerId);
    localStorage.setItem(STORAGE_NAME_KEY, ownerName);
    setState({ ownerId, ownerName });
  }

  function stopViewingAs() {
    setViewingAsOwnerId(null);
    localStorage.removeItem(STORAGE_NAME_KEY);
    setState({ ownerId: null, ownerName: null });
  }

  return (
    <ViewingAsContext.Provider value={{ ...state, startViewingAs, stopViewingAs }}>
      {children}
    </ViewingAsContext.Provider>
  );
}

export function useViewingAs(): ViewingAsContextValue {
  const ctx = useContext(ViewingAsContext);
  if (!ctx) throw new Error("useViewingAs must be used within ViewingAsProvider");
  return ctx;
}
