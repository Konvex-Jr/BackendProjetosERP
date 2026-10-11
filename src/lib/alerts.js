import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

const baseOptions = {
  buttonsStyling: false,
  customClass: {
    confirmButton: 'btn btn-primary mx-1',
    cancelButton: 'btn btn-g mx-1',
    denyButton: 'btn btn-g mx-1',
    popup: 'konvex-alert',
  },
}

const show = options => Swal.fire({ ...baseOptions, ...options })

const alerts = {
  success: (title, text = '') => show({ icon: 'success', title, text, confirmButtonText: 'Continuar' }),
  error: (title = 'Não foi possível concluir', text = 'Tente novamente.') => show({ icon: 'error', title, text, confirmButtonText: 'Entendi' }),
  info: (title, text = '') => show({ icon: 'info', title, text, confirmButtonText: 'Entendi' }),
  confirm: async ({ title = 'Confirmar ação?', text = 'Esta operação não poderá ser desfeita.', confirmText = 'Confirmar', danger = false } = {}) => {
    const result = await show({
      icon: danger ? 'warning' : 'question',
      title,
      text,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      ...(danger ? { confirmButtonColor: '#b42318' } : {}),
    })
    return result.isConfirmed
  },
  toastSuccess: (title, text = '') => Swal.fire({ ...baseOptions, toast: true, position: 'top-end', icon: 'success', title, text, showConfirmButton: false, timer: 2400, timerProgressBar: true }),
  close: () => Swal.close(),
}

export default alerts
