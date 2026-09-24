import Swal from 'sweetalert2';

export const confirmAction = async ({
  title = 'Are you sure?',
  text = 'This action cannot be undone.',
  confirmButtonText = 'Yes, Proceed',
  cancelButtonText = 'Cancel',
  icon = 'warning',
  confirmButtonColor = '#dc2626'
}) => {
  const result = await Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonColor,
    cancelButtonColor: '#64748b',
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true,
    customClass: {
      popup: 'font-sans rounded-2xl p-6',
      title: 'text-lg font-bold text-slate-800',
      htmlContainer: 'text-xs text-slate-600',
      confirmButton: 'px-4 py-2 text-xs font-semibold rounded-lg shadow-2xs',
      cancelButton: 'px-4 py-2 text-xs font-semibold rounded-lg shadow-2xs'
    }
  });

  return result.isConfirmed;
};

export const confirmDelete = async (itemName = 'item') => {
  return confirmAction({
    title: `Delete ${itemName}?`,
    text: `Are you sure you want to delete this ${itemName}? This action cannot be undone.`,
    confirmButtonText: 'Yes, Delete',
    confirmButtonColor: '#e11d48'
  });
};
