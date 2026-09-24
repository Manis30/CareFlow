import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Layers, ArrowDownRight, CheckCircle2, Clock } from 'lucide-react';

/**
 * CareFlowRevenueWaterfall
 * 
 * Revenue Realization Waterfall:
 * Visualizes transition from Gross Invoiced Appointment Inflow -> Pending Uncollected -> Settled Realized Receipts
 */
export const CareFlowRevenueWaterfall = ({
  payments = [],
  appointments = [],
  totalRevenue = 0,
  className = ''
}) => {
  const data = useMemo(() => {
    let realized = totalRevenue;
    if (payments && payments.length > 0) {
      realized = payments.reduce((sum, p) => p.status === 'paid' ? sum + (Number(p.amount) || 0) : sum, 0);
    }

    // Estimate pending fees from booked unpaid appointments
    let pendingCount = 0;
    if (appointments && appointments.length > 0) {
      pendingCount = appointments.filter((a) => a.status === 'booked' && a.paymentStatus !== 'paid').length;
    }
    const estimatedPendingAmount = pendingCount * 650; // avg consultation fee
    const grossInvoiced = realized + estimatedPendingAmount;
    const realizationRate = grossInvoiced > 0 ? Math.round((realized / grossInvoiced) * 100) : 100;

    return {
      grossInvoiced,
      estimatedPendingAmount,
      pendingCount,
      realized,
      realizationRate
    };
  }, [payments, appointments, totalRevenue]);

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-emerald-600" />
            Revenue Realization & Collection Waterfall
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Step-down from gross scheduled consultation fees to bank-settled realizations
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-200/60">
          <span>{data.realizationRate}% Realized</span>
        </div>
      </div>

      {/* Waterfall Stages */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2">
        {/* Step 1: Gross Invoiced Inflow */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              1. Gross Invoiced Value
            </span>
            <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">
              ₹{data.grossInvoiced.toLocaleString('en-IN')}
            </p>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Total potential consultation fees
          </p>
        </div>

        {/* Step 2: Pending Uncollected */}
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                2. Pending Intake
              </span>
              <span className="text-xs font-bold text-amber-700 font-mono">
                {data.pendingCount} appts
              </span>
            </div>
            <p className="text-2xl font-bold text-amber-900 mt-1 font-mono">
              - ₹{data.estimatedPendingAmount.toLocaleString('en-IN')}
            </p>
          </div>
          <p className="text-[11px] text-amber-700 mt-2">
            Awaiting session check-in / settlement
          </p>
        </div>

        {/* Step 3: Realized Receipts */}
        <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50 flex flex-col justify-between ring-1 ring-emerald-200">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                3. Realized Receipts
              </span>
              <span className="text-xs font-bold text-emerald-700 font-mono">
                Settled
              </span>
            </div>
            <p className="text-2xl font-bold text-emerald-900 mt-1 font-mono">
              ₹{data.realized.toLocaleString('en-IN')}
            </p>
          </div>
          <p className="text-[11px] text-emerald-700 mt-2 font-medium">
            100% verified Razorpay collections
          </p>
        </div>
      </div>
    </div>
  );
};

export default CareFlowRevenueWaterfall;
