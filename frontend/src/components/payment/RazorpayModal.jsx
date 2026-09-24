import React, { useState } from 'react';
import Button from '../common/Button';
import { createRazorpayOrderApi, verifyRazorpayPaymentApi } from '../../api/payment';
import { CreditCard, CheckCircle2 } from 'lucide-react';

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const RazorpayModal = ({ appointment, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePayOnline = async () => {
    try {
      setLoading(true);
      setError('');

      const loaded = await loadRazorpayScript();
      if (!loaded) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      // 1. Create Razorpay Order on Backend
      const orderRes = await createRazorpayOrderApi(appointment._id);
      const resData = orderRes.data || orderRes;
      const order = resData.order;
      const razorpayKey = resData.razorpayKeyId || resData.key || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TSMeN2ZVVnNzVP';

      if (!order) {
        throw new Error('Failed to create Razorpay payment order');
      }

      // 2. Open Official Razorpay Checkout Modal
      const options = {
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'CareFlow Healthcare',
        description: `Online Consultation Payment`,
        order_id: order.id,
        handler: async (response) => {
          try {
            setLoading(true);
            // 3. Verify Signature on Backend
            await verifyRazorpayPaymentApi({
              appointmentId: appointment._id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            });

            if (onSuccess) onSuccess();
          } catch (verifyErr) {
            const msg = verifyErr.message || 'Payment signature verification failed';
            setError(msg);
            if (onError) onError(msg);
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: appointment.patientId?.name || '',
          email: appointment.patientId?.email || ''
        },
        theme: {
          color: '#0f766e'
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        setError(resp.error?.description || 'Razorpay payment failed');
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      setError(err.message || 'Razorpay checkout initialization failed');
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-teal-50/60 border border-teal-200 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-teal-900">
          <CreditCard className="w-5 h-5 text-teal-600" />
          <span className="text-xs font-bold uppercase tracking-wider">Online Payment via Razorpay</span>
        </div>
        <span className="text-sm font-bold text-teal-800">
          ₹{appointment.doctorFee || appointment.doctorId?.consultationFee || 500}
        </span>
      </div>

      {error && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
          {error}
        </div>
      )}

      <Button
        variant="primary"
        className="w-full"
        onClick={handlePayOnline}
        loading={loading}
        icon={CheckCircle2}
      >
        Pay Now Securely
      </Button>
    </div>
  );
};

export default RazorpayModal;
