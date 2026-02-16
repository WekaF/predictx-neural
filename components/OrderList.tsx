import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

export interface BinanceOrder {
  orderId: number;
  symbol: string;
  status: 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'PENDING_CANCEL' | 'REJECTED' | 'EXPIRED';
  clientOrderId: string;
  price: string;
  avgPrice: string;
  origQty: string;
  executedQty: string;
  cumQuote: string;
  timeInForce: string;
  type: string;
  side: 'BUY' | 'SELL';
  stopPrice: string;
  time: number;
  updateTime: number;
  reduceOnly: boolean;
}

interface OrderListProps {
  orders: BinanceOrder[];
  isLoading?: boolean;
}

export const OrderList: React.FC<OrderListProps> = ({ orders, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-slate-500">
        <p className="text-sm">No orders found.</p>
      </div>
    );
  }

  // Sort by time descending (newest first)
  const sortedOrders = [...orders].sort((a, b) => b.time - a.time);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FILLED': return 'text-emerald-400';
      case 'NEW': return 'text-blue-400';
      case 'PARTIALLY_FILLED': return 'text-amber-400';
      case 'CANCELED': return 'text-slate-500';
      case 'EXPIRED': return 'text-rose-400';
      case 'REJECTED': return 'text-rose-500';
      default: return 'text-slate-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'FILLED': return <CheckCircle2 className="w-3 h-3" />;
      case 'NEW': return <Clock className="w-3 h-3" />;
      case 'PARTIALLY_FILLED': return <Clock className="w-3 h-3 text-amber-500" />;
      case 'CANCELED': return <XCircle className="w-3 h-3" />;
      case 'EXPIRED': return <AlertCircle className="w-3 h-3" />;
      case 'REJECTED': return <XCircle className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  return (
    <div className="w-full">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-slate-900 z-10 text-[10px] uppercase text-slate-500 font-bold tracking-wider">
          <tr>
            <th className="px-4 py-2 border-b border-slate-800">Time</th>
            <th className="px-4 py-2 border-b border-slate-800">Symbol</th>
            <th className="px-4 py-2 border-b border-slate-800">Side</th>
            <th className="px-4 py-2 border-b border-slate-800 text-right">Price</th>
            <th className="px-4 py-2 border-b border-slate-800 text-right">Filled / Qty</th>
            <th className="px-4 py-2 border-b border-slate-800 text-right">Total (USDT)</th>
            <th className="px-4 py-2 border-b border-slate-800 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {sortedOrders.map((order) => {
            const isBuy = order.side === 'BUY';
            const price = parseFloat(order.avgPrice) > 0 ? parseFloat(order.avgPrice) : parseFloat(order.price);
            const total = parseFloat(order.cumQuote) > 0 ? parseFloat(order.cumQuote) : price * parseFloat(order.executedQty);

            return (
              <tr key={order.orderId} className="hover:bg-slate-800/30 transition-colors text-xs font-mono group">
                <td className="px-4 py-2 text-slate-400 whitespace-nowrap">
                  {new Date(order.time).toLocaleString('id-ID', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                  })}
                </td>
                <td className="px-4 py-2 font-bold text-slate-300">
                  {order.symbol}
                  {order.reduceOnly && <span className="ml-1 text-[9px] text-amber-500 bg-amber-500/10 px-1 rounded">R</span>}
                </td>
                <td className={`px-4 py-2 font-bold ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <div className="flex items-center gap-1">
                    {isBuy ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    {order.side}
                  </div>
                </td>
                <td className="px-4 py-2 text-right text-slate-300">
                  {price === 0 ? 'Market' : price.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right">
                  <span className={parseFloat(order.executedQty) === parseFloat(order.origQty) ? 'text-emerald-400' : 'text-slate-300'}>
                    {parseFloat(order.executedQty)}
                  </span>
                  <span className="text-slate-500"> / {parseFloat(order.origQty)}</span>
                </td>
                <td className="px-4 py-2 text-right text-slate-300">
                  {total > 0 ? total.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'}
                </td>
                <td className={`px-4 py-2 text-right font-bold flex items-center justify-end gap-1.5 ${getStatusColor(order.status)}`}>
                  {getStatusIcon(order.status)}
                  {order.status}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
