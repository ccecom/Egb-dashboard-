import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Package, Truck } from 'lucide-react';
import { useOrders } from '../context/OrderContext';
import type { Order } from '../context/OrderContext';
import api, { apiErrorMessage } from '../services/api';

const DEFAULT_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
type AnyRecord = Record<string, any>;
const first = (...values: any[]) => values.find((value) => value !== undefined && value !== null && value !== '');
const money = (value: any) => `₱${(Number(value) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const unwrap = (data: any) => data?.order ?? data?.data?.order ?? data?.data ?? data;

const OrderDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orders, fetchOrderById, updateOrderStatus } = useOrders();
  const cachedOrder = orders.find((item: any) => String(item.id ?? item._id) === String(id));
  const [order, setOrder] = useState<Order | null>(cachedOrder ?? null);
  const [registeredUser, setRegisteredUser] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(!cachedOrder);
  const [updating, setUpdating] = useState(false);
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');

  useEffect(() => {
    let active = true;
    if (!id) { setError('Order ID is missing.'); setLoading(false); return; }
    (async () => {
      setLoading(true); setError(null);
      try {
        const result = await fetchOrderById(id);
        if (active && result) setOrder(result);
        else if (active && !cachedOrder) setError('Order not found.');
      } catch (err) {
        if (active && !cachedOrder) setError(apiErrorMessage(err, 'Failed to load order details.'));
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id, fetchOrderById]);

  useEffect(() => {
    if (!order) return;
    const data = order as AnyRecord;
    setEstimatedDelivery(String(first(data.estimated_delivery, data.estimatedDelivery, '')));
    setDeliveryNote(String(first(data.notes, data.delivery_note, data.deliveryNote, '')));
  }, [order]);

  useEffect(() => {
    const data = order as AnyRecord | null;
    const userId = first(data?.user_id, data?.userId);
    if (!userId || userId === 'guest') { setRegisteredUser(null); return; }
    let active = true;
    api.get(`/api/v1/users/${encodeURIComponent(String(userId))}`)
      .then((response) => { if (active) setRegisteredUser(response.data?.user ?? response.data?.data ?? response.data); })
      .catch(() => { if (active) setRegisteredUser(null); });
    return () => { active = false; };
  }, [order]);

  const handleStatusChange = async (newStatus: string) => {
    if (!order || !id || updating) return;
    const previous = order;
    setUpdating(true); setError(null); setSuccess(null);
    setOrder({ ...order, status: newStatus } as Order);
    try {
      if (typeof updateOrderStatus !== 'function') throw new Error('OrderContext does not provide updateOrderStatus().');
      const updated = await updateOrderStatus(id, newStatus);
      if (updated) setOrder(updated);
      setSuccess('Order status saved successfully.');
    } catch (err) {
      setOrder(previous);
      setError(apiErrorMessage(err, 'Could not update order status. The database was not confirmed updated.'));
    } finally { setUpdating(false); }
  };

  const handleSaveDeliveryInfo = useCallback(async () => {
    const data = order as AnyRecord | null;
    const targetId = first(data?._id, data?.id, id);
    if (!targetId || !order) { setError('A valid order ID is required.'); return; }
    setSavingDelivery(true); setError(null); setSuccess(null);
    try {
      const response = await api.put(`/api/v1/orders/${encodeURIComponent(String(targetId))}`, {
        estimated_delivery: estimatedDelivery,
        notes: deliveryNote,
      });
      const updated = unwrap(response.data);
      if (updated && typeof updated === 'object') setOrder(updated as Order);
      else setOrder({ ...order, estimated_delivery: estimatedDelivery, notes: deliveryNote } as Order);
      setSuccess('Delivery details saved successfully.');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save delivery details. Check that the backend supports PUT /api/v1/orders/{id}.'));
    } finally { setSavingDelivery(false); }
  }, [order, id, estimatedDelivery, deliveryNote]);

  if (loading && !order) return <div className="flex h-64 items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-600"/></div>;
  if (!order) return <div className="mx-auto max-w-4xl p-6"><div className="rounded-xl bg-red-50 p-4 text-red-700">{error || 'Order not found.'}</div><button onClick={() => navigate('/dashboard/orders')} className="mt-4 text-sm font-bold text-indigo-600">← Back to Orders</button></div>;

  const o = order as AnyRecord;
  const orderId = String(first(o.order_number, String(o._id ?? o.id ?? id).slice(-6).toUpperCase()));
  const status = String(o.status ?? 'pending').toLowerCase();
  const statuses = DEFAULT_STATUSES.includes(status) ? DEFAULT_STATUSES : [...DEFAULT_STATUSES, status];
  const shipping = o.shipping_address ?? o.shippingAddress ?? {};
  const items: AnyRecord[] = Array.isArray(o.items) ? o.items : Array.isArray(o.orderItems) ? o.orderItems : [];
  const total = first(o.total_amount, o.totalAmount, o.total, 0);
  const checkoutName = first(o.customer_name, o.shipping_full_name, shipping.full_name, shipping.fullName, 'N/A');
  const checkoutEmail = first(o.customer_email, o.shipping_email, shipping.email, 'N/A');
  const checkoutPhone = first(o.customer_phone, o.shipping_mobile_number, shipping.phone, shipping.mobileNumber, 'N/A');
  const userName = first(registeredUser?.name, registeredUser?.full_name, registeredUser?.fullName, registeredUser?.username, o.user_id === 'guest' ? 'Guest Checkout' : 'Not found');
  const userEmail = first(registeredUser?.email, checkoutEmail);
  const userPhone = first(registeredUser?.phone, registeredUser?.mobile_number, registeredUser?.mobile, checkoutPhone);
  const date = first(o.date, o.created_at, o.createdAt);

  return <main className="mx-auto max-w-6xl space-y-6 p-4 font-sans sm:p-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><button onClick={() => navigate('/dashboard/orders')} className="mb-2 text-sm font-bold text-indigo-600 hover:underline">← Back to Orders</button><h1 className="text-2xl font-black text-gray-900">Order #{orderId}</h1><p className="mt-1 text-sm text-gray-500">Placed on {date ? new Date(date).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : 'Date unavailable'}</p></div><div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3"><label htmlFor="order-status" className="text-xs font-bold uppercase tracking-wide text-gray-500">Order status</label><select id="order-status" value={status} onChange={(e) => void handleStatusChange(e.target.value)} disabled={updating} className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-bold capitalize disabled:opacity-50">{statuses.map((value) => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}</select>{updating && <span className="text-xs text-gray-500">Saving…</span>}</div></header>
    {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle size={18} className="mt-0.5 shrink-0"/>{error}</div>}
    {success && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18}/>{success}</div>}
    <section className="rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-blue-50 p-5 shadow-sm sm:p-6"><h2 className="mb-4 flex items-center gap-2 font-extrabold text-indigo-950"><Truck size={19}/> Delivery & Tracking Updates</h2><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div><label htmlFor="delivery-date" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-indigo-900">Estimated delivery date / time</label><input id="delivery-date" value={estimatedDelivery} onChange={(e) => setEstimatedDelivery(e.target.value)} placeholder="e.g. Oct 20–21, 2026" className="w-full rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm text-gray-900"/></div><div><label htmlFor="delivery-note" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-indigo-900">Status description / admin note</label><input id="delivery-note" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} placeholder="e.g. Out for delivery" className="w-full rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm text-gray-900"/></div></div><div className="mt-4 flex justify-end"><button onClick={() => void handleSaveDeliveryInfo()} disabled={savingDelivery} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">{savingDelivery ? 'Saving…' : 'Save delivery details'}</button></div></section>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3"><div className="space-y-6 lg:col-span-2"><section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm"><div className="border-b border-gray-100 px-6 py-4"><h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide"><Package size={17}/> Order Items ({items.length})</h2></div><div className="divide-y divide-gray-100">{items.length ? items.map((item, index) => { const qty = Number(item.quantity ?? item.qty ?? 1); const price = Number(item.price ?? item.unit_price ?? 0); return <div key={String(item.id ?? item.product_id ?? index)} className="flex items-center gap-4 px-5 py-4 sm:px-6">{item.image ? <img src={item.image} alt={item.name ?? 'Product'} className="h-16 w-16 rounded-xl border border-gray-100 object-cover"/> : <div className="flex h-16 w-16 items-center justify-center rounded-xl border bg-gray-50 text-xs text-gray-400">No image</div>}<div className="min-w-0 flex-1"><p className="font-bold text-gray-900">{item.name ?? item.product_name ?? 'Product'}</p><p className="mt-1 text-xs text-gray-500">Qty: {qty} × {money(price)}</p></div><p className="whitespace-nowrap font-black text-gray-900">{money(qty * price)}</p></div>; }) : <p className="p-8 text-center text-sm text-gray-400">No item details were returned for this order.</p>}</div></section><section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"><div className="space-y-3 text-sm"><div className="flex justify-between text-gray-600"><span>Subtotal</span><span className="font-bold text-gray-900">{money(first(o.subtotal, total))}</span></div><div className="flex justify-between border-t border-gray-100 pt-3 text-base font-black"><span>Total amount</span><span className="text-indigo-600">{money(total)}</span></div></div></section></div>
    <aside className="space-y-6"><InfoCard title="Registered User Account" rows={[["Account name", userName], ["Account email", userEmail], ["Account phone", userPhone], ["User ID", first(o.user_id, o.userId, 'N/A')]]}/><InfoCard title="Checkout Shipping Info" rows={[["Recipient", checkoutName], ["Email", checkoutEmail], ["Phone", checkoutPhone]]}/><InfoCard title="Delivery Address" rows={[["Street", first(shipping.address_line1, shipping.street, o.shipping_street, '')], ["Barangay", first(shipping.address_line2, shipping.barangay, o.shipping_barangay, '')], ["City", first(shipping.city, o.shipping_city, '')], ["Region", first(shipping.state, shipping.region, o.shipping_region, '')], ["Postal code", first(shipping.postal_code, shipping.zipCode, o.shipping_zip_code, '')], ["Country", first(shipping.country, o.shipping_country, 'Philippines')], ["Landmark", first(shipping.landmark, o.shipping_landmark, '')]]}/><InfoCard title="Payment Info" rows={[["Method", String(first(o.payment_method, o.paymentMethod, 'Cash on Delivery')).replace(/_/g, ' ')], ["Payment status", first(o.payment_status, o.paymentStatus, 'Pending')]]}/></aside></div>
  </main>;
};

function InfoCard({ title, rows }: { title: string; rows: [string, any][] }) { return <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="mb-4 border-b border-gray-100 pb-3 text-xs font-extrabold uppercase tracking-wide text-gray-800">{title}</h2><div className="space-y-3">{rows.filter(([, value]) => value !== '').map(([label, value]) => <div key={label}><span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</span><p className="mt-0.5 break-words text-sm font-medium text-gray-800">{String(value ?? 'N/A')}</p></div>)}</div></section>; }
export default OrderDetails;
