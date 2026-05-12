export const showAppToast = (message, type = 'success') => {
  if (!message || typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent('app:toast', {
    detail: {
      message,
      type
    }
  }));
};

export const confirmAppAction = ({ message, title = 'Confirm action', confirmLabel = 'Continue', cancelLabel = 'Cancel' }) => (
  new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    window.dispatchEvent(new CustomEvent('app:confirm', {
      detail: {
        title,
        message,
        confirmLabel,
        cancelLabel,
        resolve
      }
    }));
  })
);
