import Swal, { SweetAlertIcon } from 'sweetalert2';

export type ConfirmAlertOptions = {
  title?: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: SweetAlertIcon;
};

export type StyledAlertOptions = {
  title?: string;
  text?: string;
  confirmText?: string;
  icon?: SweetAlertIcon;
};

const STYLE_ID = 'confirm-alert-style';
const CANVAS_OVERLAY_OPEN_ATTR = 'data-canvas-overlay-open';

const ensureAlertStyles = () => {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.innerHTML = `
    .confirm-alert-popup {
      border-radius: 22px !important;
      padding-top: 12px !important;
      overflow: hidden;
      position: relative;
    }
    .confirm-alert-popup::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 10px;
      background: linear-gradient(90deg, #2D7498, #33AD9B);
    }
    .confirm-alert-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-top: 6px;
      flex-direction: row !important;
    }
  `;

  document.head.appendChild(style);
};

const popupClass = 'confirm-alert-popup shadow-2xl px-8 pt-6 pb-6';
const titleClass = 'text-lg md:text-xl font-semibold text-slate-800 mt-2 mb-1 text-center';
const htmlClass = 'text-sm text-slate-500 mb-3 text-center';
const actionsClass = 'confirm-alert-actions';
const confirmClass =
  'px-6 py-2 rounded-full bg-[#E53E3E] text-white font-semibold text-sm shadow hover:bg-[#C53030] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E53E3E]';
const cancelClass =
  'px-6 py-2 rounded-full bg-white text-slate-700 border border-slate-200 font-semibold text-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200';
const primaryClass =
  'px-6 py-2 rounded-full bg-[#2D7498] text-white font-semibold text-sm shadow hover:bg-[#245975] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2D7498]';

export const confirmAlert = async (opts: ConfirmAlertOptions = {}) => {
  ensureAlertStyles();

  const {
    title = '¿Estas seguro?',
    text = '',
    confirmText = 'Si, eliminar',
    cancelText = 'Cancelar',
    icon = 'question',
  } = opts;

  const result = await Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: false,
    buttonsStyling: false,
    customClass: {
      popup: popupClass,
      title: titleClass,
      htmlContainer: htmlClass,
      actions: actionsClass,
      confirmButton: confirmClass,
      cancelButton: cancelClass,
    },
    didOpen: () => {
      document.body.setAttribute(CANVAS_OVERLAY_OPEN_ATTR, 'true');
    },
    willClose: () => {
      document.body.removeAttribute(CANVAS_OVERLAY_OPEN_ATTR);
    },
    didDestroy: () => {
      document.body.removeAttribute(CANVAS_OVERLAY_OPEN_ATTR);
    },
  });

  return result.isConfirmed;
};

export const showStyledAlert = async (opts: StyledAlertOptions = {}) => {
  ensureAlertStyles();

  const {
    title = 'Aviso',
    text = '',
    confirmText = 'Aceptar',
    icon = 'info',
  } = opts;

  return Swal.fire({
    title,
    text,
    icon,
    confirmButtonText: confirmText,
    buttonsStyling: false,
    customClass: {
      popup: popupClass,
      title: titleClass,
      htmlContainer: htmlClass,
      actions: actionsClass,
      confirmButton: primaryClass,
    },
    didOpen: () => {
      document.body.setAttribute(CANVAS_OVERLAY_OPEN_ATTR, 'true');
    },
    willClose: () => {
      document.body.removeAttribute(CANVAS_OVERLAY_OPEN_ATTR);
    },
    didDestroy: () => {
      document.body.removeAttribute(CANVAS_OVERLAY_OPEN_ATTR);
    },
  });
};

export const closeStyledAlert = () => {
  Swal.close();
  document.body.removeAttribute(CANVAS_OVERLAY_OPEN_ATTR);
};

export default {
  confirmAlert,
  showStyledAlert,
  closeStyledAlert,
};
