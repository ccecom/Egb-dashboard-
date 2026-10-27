import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrders } from '../context/OrderContext';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object') {
    const err = error as {
      message?: string;
      response?: {
        data?: {
          detail?: unknown;
          message?: string;
          error?: string;
        };
      };
    };

    const data = err.response?.data;

    if (typeof data?.detail === 'string') return data.detail;

    if (Array.isArray(data?.detail)) {
      return data.detail
        .map((item: any) => item?.msg || JSON.stringify(item))
        .join(', ');
    }

    if (typeof data?.message === 'string') return data.message;
    if (typeof data?.error === 'string') return data.error;
    if (typeof err.message === 'string') return err.message;
  }

  return fallback;
};

const OrderList: React.FC = () => {
  const navigate = useNavigate();

  const {
    orders,
    isLoading,
    loading,
    error,
    fetchOrders,
    deleteOrder,
  } = useOrders();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadingOrders = Boolean(isLoading ?? loading);

  const refreshOrders = useCallback(async () => {
    setErrorMsg(null);

    try {
      await fetchOrders();
    } catch (err) {
      setErrorMsg(getErrorMessage(err, 'Failed to load orders.'));
    }
  }, [fetchOrders]);

  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);

  useEffect(() => {
    if (!successMsg) return;

    const timer = window.setTimeout(() => setSuccessMsg(null), 3000);
    return () => window.clearTimeout(timer);
  }, [successMsg]);

  const filteredOrders = useMemo(() => {
    const list = Array.isArray(orders) ? orders : [];
    const query = search.trim().toLowerCase();

    return list.filter((order: any) => {
      const orderNumber = String(order.order_number ?? '').toLowerCase();
      const customerName = String(order.customer_name ?? '').toLowerCase();
      const customerEmail = String(order.customer_email ?? '').toLowerCase();
      const status = String(order.status ?? 'pending').toLowerCase();

      const matchesSearch =
        !query ||
        orderNumber.includes(query) ||
        customerName.includes(query) ||
        customerEmail.includes(query);

      const matchesStatus =
        statusFilter === 'all' || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const handleDelete = async (id: string) => {
    if (!id || isDeleting) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsDeleting(true);

    try {
      await deleteOrder(id);
      setConfirmDeleteId(null);
      setSuccessMsg('Order successfully deleted.');

      // Keep the displayed list synchronized with the server.
      await fetchOrders();
    } catch (err) {
      setErrorMsg(getErrorMessage(err, 'Failed to delete order.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const displayedError =
    errorMsg ||
    (error ? getErrorMessage(error, 'Failed to load orders.') : null);

  if (loadingOrders && (!Array.isArray(orders) || orders.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"
          role="status"
          aria-label="Loading orders"
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Manage and track all customer orders
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshOrders()}
          disabled={loadingOrders}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition font-bold text-sm shadow-sm"
        >
          {loadingOrders ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {successMsg && (
        <div
          role="status"
          className="mb-4 p-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 rounded-xl text-sm font-bold shadow-sm"
        >
          {successMsg}
        </div>
      )}

      {displayedError && (
        <div
          role="alert"
          className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-xl text-sm font-bold shadow-sm"
        >
          {displayedError}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="search"
          placeholder="Search by order #, name or email..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium shadow-sm"
        />

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white font-bold shadow-sm cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-500 text-sm font-semibold"
                  >
                    {search || statusFilter !== 'all'
                      ? 'No orders match your search or filter.'
                      : 'No orders found.'}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order: any) => {
                  const currentId = String(order.id ?? order._id ?? '');
                  const isConfirming = confirmDeleteId === currentId;
                  const orderDate = order.created_at ?? order.date;
                  const status = String(order.status ?? 'pending');
                  const normalizedStatus = status.toLowerCase();
                  const total = Number(
                    order.total ?? order.total_amount ?? 0
                  );

                  return (
                    <tr
                      key={currentId || order.order_number}
                      className="hover:bg-gray-50 transition cursor-pointer"
                      onClick={() => {
                        if (currentId) {
                          navigate(`/dashboard/orders/${currentId}`);
                        }
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-black text-indigo-600">
                          #
                          {order.order_number ||
                            currentId.slice(-8).toUpperCase() ||
                            'UNKNOWN'}
                        </div>
                        <div className="text-xs text-gray-500 font-medium">
                          {Array.isArray(order.items) ? order.items.length : 0}
                          {' item(s)'}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900">
                          {order.customer_name || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500 font-medium">
                          {order.customer_email || 'N/A'}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                        {orderDate
                          ? new Date(orderDate).toLocaleDateString()
                          : '—'}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-gray-900">
                        ₱{(Number.isFinite(total) ? total : 0).toLocaleString()}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            statusColors[normalizedStatus] ||
                            'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {status}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md">
                          {order.payment_status || 'Pending'}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (currentId) {
                              navigate(`/dashboard/orders/${currentId}`);
                            }
                          }}
                          className="text-indigo-600 hover:text-indigo-900 font-bold mr-3"
                        >
                          View
                        </button>

                        {isConfirming ? (
                          <span
                            className="inline-flex items-center gap-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => void handleDelete(currentId)}
                              className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition shadow-sm"
                            >
                              {isDeleting ? 'Deleting...' : 'Confirm'}
                            </button>

                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-300 disabled:opacity-50 transition"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={!currentId}
                            onClick={(event) => {
                              event.stopPropagation();
                              setConfirmDeleteId(currentId);
                            }}
                            className="text-red-600 hover:text-red-900 disabled:opacity-40 font-bold"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OrderList;