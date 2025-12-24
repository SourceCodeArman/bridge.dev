import { toast as sonnerToast } from 'sonner';

export const toast = {
    success: (message: string) => {
        return sonnerToast.success(message);
    },
    error: (message: string) => {
        return sonnerToast.error(message);
    },
    info: (message: string) => {
        return sonnerToast.info(message);
    },
    warning: (message: string) => {
        return sonnerToast.warning(message);
    },
    loading: (message: string) => {
        return sonnerToast.loading(message);
    },
    promise: sonnerToast.promise,
    custom: sonnerToast.custom,
    dismiss: sonnerToast.dismiss,
};

export const useToast = () => {
    return toast;
};
