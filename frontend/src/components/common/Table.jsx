import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import UserAvatar from './UserAvatar';

/**
 * CareFlow Universal Table System Primitives
 * Private Clinical Design Language
 */

export const TableContainer = ({ children, className = '' }) => (
  <div className={`app-table-container bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden ${className}`}>
    <div className="overflow-x-auto min-w-full">
      {children}
    </div>
  </div>
);

export const Table = ({ children, className = '' }) => (
  <table className={`app-table w-full text-left font-sans text-xs border-collapse ${className}`}>
    {children}
  </table>
);

export const TableHeader = ({ children, className = '' }) => (
  <thead className={`app-table-head bg-slate-50/75 text-slate-500 border-b border-slate-200/80 ${className}`}>
    {children}
  </thead>
);

export const TableHeadCell = ({ children, align = 'left', className = '' }) => {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th className={`app-table-th px-4 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider ${alignClass} ${className}`}>
      {children}
    </th>
  );
};

export const TableBody = ({ children, className = '' }) => (
  <tbody className={`app-table-body divide-y divide-slate-100 ${className}`}>
    {children}
  </tbody>
);

export const TableRow = ({ children, onClick, hoverable = true, className = '' }) => (
  <tr
    onClick={onClick}
    className={`app-table-row transition-colors duration-150 group ${
      onClick ? 'cursor-pointer' : ''
    } ${hoverable ? 'hover:bg-blue-50/40' : ''} ${className}`}
  >
    {children}
  </tr>
);

export const TableCell = ({
  children,
  align = 'left',
  variant = 'primary', // 'primary' | 'secondary' | 'muted'
  className = ''
}) => {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  let variantClass = 'text-slate-900 font-semibold text-xs sm:text-sm';
  if (variant === 'primary') {
    variantClass = 'text-slate-900 font-semibold text-xs sm:text-sm';
  } else if (variant === 'secondary') {
    variantClass = 'text-slate-600 font-medium text-xs';
  } else if (variant === 'muted') {
    variantClass = 'text-slate-400 font-medium text-xs';
  }

  return (
    <td className={`app-table-td px-4 py-3.5 ${alignClass} ${variantClass} ${className}`}>
      {children}
    </td>
  );
};

export const TableIdentityCell = ({
  avatarUrl,
  primaryText,
  secondaryText,
  user,
  role = 'user',
  onClick,
  className = ''
}) => (
  <td className={`app-table-td px-4 py-3.5 ${className}`}>
    <div className="flex items-center gap-3">
      <UserAvatar
        user={user}
        src={avatarUrl}
        name={primaryText}
        role={role}
        size="md"
      />

      <div className="flex flex-col justify-center space-y-0.5 truncate">
        {onClick ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick(e);
            }}
            className="text-xs sm:text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors text-left truncate cursor-pointer"
          >
            {primaryText}
          </button>
        ) : (
          <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
            {primaryText}
          </span>
        )}
        {secondaryText && (
          <span className="text-[11px] text-slate-500 font-medium truncate">
            {secondaryText}
          </span>
        )}
      </div>
    </div>
  </td>
);

export const TableAmountCell = ({ amount, currency = '₹', align = 'left', className = '' }) => (
  <TableCell align={align} className={`font-semibold text-slate-900 text-xs sm:text-sm ${className}`}>
    {currency}{amount}
  </TableCell>
);

export const CompletedVisitsBadge = ({ count = 0, className = '' }) => {
  const numCount = Number(count) || 0;
  const isActive = numCount > 0;

  return (
    <span
      className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all ${
        isActive
          ? 'bg-blue-50 text-blue-700 border-blue-200/60'
          : 'bg-slate-50 text-slate-500 border-slate-200'
      } ${className}`}
    >
      {isActive && (
        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
      )}
      <span className={isActive ? 'font-bold text-blue-700' : 'font-medium text-slate-500'}>
        {numCount}
      </span>
    </span>
  );
};

export default {
  TableContainer,
  Table,
  TableHeader,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  TableIdentityCell,
  TableAmountCell,
  CompletedVisitsBadge
};
