export type NoticeTone = 'info' | 'success' | 'error' | 'warning';

const iconByTone: Record<NoticeTone, string> = {
  info: 'ph-info', success: 'ph-check-circle', error: 'ph-warning-circle', warning: 'ph-warning',
};

export function AdminNotice({ message, tone = 'info', onDismiss }: { message: string; tone?: NoticeTone; onDismiss?: () => void }) {
  if (!message) return null;
  return <div className={`admin-notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'}>
    <i className={`ph ${iconByTone[tone]}`} aria-hidden="true" />
    <span>{message}</span>
    {onDismiss && <button type="button" aria-label="Stäng meddelandet" onClick={onDismiss}><i className="ph ph-x" aria-hidden="true" /></button>}
  </div>;
}

export function AdminLoading({ label = 'Laddar innehåll' }: { label?: string }) {
  return <div className="admin-loading" role="status"><i className="ph ph-spinner-gap" aria-hidden="true" /><span>{label}…</span></div>;
}

export function CharacterCount({ value, max, id }: { value: string; max: number; id?: string }) {
  const remaining = max - value.length;
  return <small id={id} aria-hidden="true" className={remaining < Math.min(20, max * .1) ? 'character-count is-near-limit' : 'character-count'}>{value.length} av {max} tecken</small>;
}
