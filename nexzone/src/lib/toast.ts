export type ToastType = 'success' | 'error' | 'info';
export function toast(message: string, type: ToastType = 'info') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nz-toast', { detail: { message, type } }));
  }
}
