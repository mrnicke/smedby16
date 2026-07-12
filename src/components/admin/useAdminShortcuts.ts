import { useEffect } from 'react';

export function useSaveShortcut(enabled: boolean, save: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!enabled || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      save();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, save]);
}
