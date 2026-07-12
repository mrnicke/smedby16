import { useEffect } from 'react';

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}

export function confirmDiscard(dirty: boolean) {
  return !dirty || confirm('Du har osparade ändringar. Vill du lämna dem utan att spara?');
}
