import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type DirtyContextValue = { dirty: boolean; setDirty: (dirty: boolean) => void };
const DirtyContext = createContext<DirtyContextValue | null>(null);

export function AdminDirtyProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const value = useMemo(() => ({ dirty, setDirty }), [dirty]);
  return createElement(DirtyContext.Provider, { value }, children);
}

export function useAdminDirtyState() {
  return useContext(DirtyContext) ?? { dirty: false, setDirty: () => undefined };
}

export function useUnsavedChanges(dirty: boolean) {
  const context = useContext(DirtyContext);
  const setGlobalDirty = context?.setDirty;
  useEffect(() => {
    setGlobalDirty?.(dirty);
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      setGlobalDirty?.(false);
    };
  }, [dirty, setGlobalDirty]);
}

export function confirmDiscard(dirty: boolean) {
  return !dirty || confirm('Du har osparade ändringar. Vill du lämna dem utan att spara?');
}
