import Swal from 'sweetalert2';

export type ToastType = 'success' | 'error' | 'warning';

const palette: Record<ToastType, { bg: string; fg: string; border: string; icon: string }> = {
  success: { bg: '#22c55e', fg: '#ffffff', border: '#16a34a', icon: '&#10003;' },
  error: { bg: '#ef4444', fg: '#ffffff', border: '#dc2626', icon: '!' },
  warning: { bg: '#f59e0b', fg: '#1f2937', border: '#d97706', icon: '!' },
};

const STYLE_ID = 'app-toast-style';

const ensureToastStyles = () => {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.innerHTML = `
    .app-toast-popup.swal2-popup.swal2-toast {
      width: auto !important;
      padding: 0 !important;
      background: transparent !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      overflow: visible !important;
    }
    .app-toast-popup .swal2-html-container {
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
    }
    .app-toast-popup .swal2-title,
    .app-toast-popup .swal2-icon {
      display: none !important;
    }
  `;

  document.head.appendChild(style);
};

const toast = Swal.mixin({
  toast: true,
  position: 'bottom-end',
  showConfirmButton: false,
  timer: 4800,
  timerProgressBar: false,
  width: 'auto',
  padding: 0,
  customClass: {
    popup: 'app-toast-popup',
  },
});

export const showToast = (type: ToastType, title: string, text?: string) => {
  ensureToastStyles();

  const paletteItem = palette[type];
  const body = `
    <div style="
      display:flex;
      align-items:center;
      gap:10px;
      background:${paletteItem.bg};
      color:${paletteItem.fg};
      padding:10px 14px;
      border-radius:12px;
      box-shadow:0 10px 25px rgba(0,0,0,0.15);
      min-width:220px;
      max-width:340px;
      border:1px solid ${paletteItem.border};
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    ">
      <span style="
        display:inline-flex;
        align-items:center;
        justify-content:center;
        width:20px;
        height:20px;
        border-radius:9999px;
        border:2px solid ${paletteItem.fg};
        font-size:12px;
        font-weight:700;
        line-height:1;
        background:rgba(255,255,255,0.12);
      ">${paletteItem.icon}</span>
      <div style="flex:1; display:flex; flex-direction:column; gap:2px;">
        <span style="font-size:13px; font-weight:700; line-height:1.2;">${title}</span>
        ${
          text
            ? `<span style="font-size:12px; line-height:1.3; color:${paletteItem.fg};">${text}</span>`
            : ''
        }
      </div>
      <button type="button" data-close="true" style="
        border:0;
        background:transparent;
        color:${paletteItem.fg};
        font-size:16px;
        line-height:1;
        padding:4px;
        cursor:pointer;
      ">X</button>
    </div>
  `;

  return toast.fire({
    icon: undefined,
    title: undefined,
    text: undefined,
    html: body,
    background: 'transparent',
    didOpen: (el) => {
      el.style.margin = '0 10px 10px 0';
      const closeBtn = el.querySelector('[data-close="true"]') as HTMLButtonElement | null;
      closeBtn?.addEventListener('click', () => {
        Swal.close();
      });
    },
  });
};

export const toastSuccess = (title: string, text?: string) => showToast('success', title, text);

export const toastError = (title: string, text?: string) => showToast('error', title, text);

export const toastWarning = (title: string, text?: string) => showToast('warning', title, text);
