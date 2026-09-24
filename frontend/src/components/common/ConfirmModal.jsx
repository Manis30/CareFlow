import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Textarea from './Textarea';

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
  requireReason = false,
  reasonLabel = 'Reason'
}) => {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (requireReason) {
      onConfirm(reason);
    } else {
      onConfirm();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>

        {requireReason && (
          <Textarea
            label={reasonLabel}
            placeholder="Please enter a reason..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        )}

        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={handleConfirm}
            loading={loading}
            disabled={requireReason && !reason.trim()}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
