import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { ArrowUp, RefreshCw, AlertCircle } from 'lucide-react';
import api, { apiErrorMessage } from '../services/api';

const MONTHLY_REVENUE_TARGET = 50000;
const CHART_COLORS = ['#1e1b4b', '#10b981', '#8b5cf6', '#e5e7eb', '#f59e0b', '#3b82f6'];
type AnyRecord = Record<string, any>;
const unwrapList = (value: any, keys: string[]): AnyRecord[] => {
  if (Array.isArray(value)) return value;
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key];
  if (Array.isArray(value?.data)) return value.data;
  return [];
};
const amountOf = (record: AnyRecord): number => {
  const raw = record.totalAmount ?? record.total_amount ?? record.amount ?? record.total ?? 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};
const peso = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ sales: 0, orders: 0, revenue: 0, customers: 0 });
  const [revenueData, setRevenueData] = useState<{ name: string; current: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; price: number; category: string; qty: number; revenue: number }[]>([]);
  const [locationData, setLocationData] = useState<{ city: string; value: number; percent: number }[]>([]);
  const [channelData, setChannelData] = useState<{ name: string; value: number; color: string }[]>([]);

  const fetchLiveData = useCallback(async (quiet = false) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    if (quiet) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [ordersResponse, productsResponse, usersResponse] = await Promise.all([
        api.get('/api/v1/orders', { signal: controller.signal }),
        api.get('/api/v1/products', { signal: controller.signal }),
        api.get('/api/v1/analytics/users', { signal: controller.signal }),
      ]);
      const orders = unwrapList(ordersResponse.data, ['orders']);
      // Products are fetched to verify the endpoint and keep dashboard sync aligned; ranking uses purchased order items.
      unwrapList(productsResponse.data, ['products']);
      const users = unwrapList(usersResponse.data, ['users']);
      const revenue = orders.reduce((sum, order) => sum + amountOf(order), 0);
      setStats({ sales: revenue, orders: orders.length, revenue, customers: users.length });

      const daily: Record<string, number> = {};
      const productSales: Record<string, { name: string; price: number; category: string; qty: number; revenue: number }> = {};
      const citySales: Record<string, number> = {};
      const channelSales: Record<string, number> = {};
      orders.forEach((order) => {
        const rawDate = order.createdAt ?? order.created_at ?? order.date;
        if (rawDate) {
          const date = String(rawDate).slice(0, 10);
          daily[date] = (daily[date] || 0) + amountOf(order);
        }
        const items = order.items ?? order.orderItems ?? order.order_items ?? order.products ?? [];
        if (Array.isArray(items)) items.forEach((item: AnyRecord) => {
          const key = String(item.productId ?? item.product_id ?? item.id ?? item.name ?? 'unknown');
          const name = String(item.name ?? item.productName ?? item.product_name ?? 'Unknown product');
          const qty = Math.max(0, Number(item.quantity ?? item.qty ?? 1) || 1);
          const price = Number(item.price ?? item.unitPrice ?? item.unit_price ?? 0) || 0;
          if (!productSales[key]) productSales[key] = { name, price, category: String(item.category ?? 'General'), qty: 0, revenue: 0 };
          productSales[key].qty += qty;
          productSales[key].revenue += qty * price;
        });
        const city = String(order.shippingAddress?.city ?? order.shipping_address?.city ?? order.shipping_city ?? order.city ?? 'Unspecified');
        citySales[city] = (citySales[city] || 0) + amountOf(order);
        const channel = String(order.channel ?? order.source ?? order.payment_method ?? order.paymentMethod ?? 'Direct');
        channelSales[channel] = (channelSales[channel] || 0) + amountOf(order);
      });
      setRevenueData(Object.keys(daily).sort().slice(-6).map((date) => ({ name: date.slice(5), current: daily[date] })));
      setTopProducts(Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 6));
      setLocationData(Object.entries(citySales).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([city, value]) => ({ city, value, percent: revenue > 0 ? (value / revenue) * 100 : 0 })));
      setChannelData(Object.entries(channelSales).map(([name, value], index) => ({ name, value, color: CHART_COLORS[index % CHART_COLORS.length] })).sort((a, b) => b.value - a.value));
    } catch (err) {
      if ((err as any)?.name === 'CanceledError' || (err as any)?.name === 'AbortError') setError('The dashboard request timed out. Please retry.');
      else setError(apiErrorMessage(err, 'Unable to load dashboard data. Verify that the API endpoints are available.'));
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchLiveData();
    const interval = window.setInterval(() => void fetchLiveData(true), 60000);
    return () => window.clearInterval(interval);
  }, [fetchLiveData]);

  const targetProgress = useMemo(() => Math.min((stats.revenue / MONTHLY_REVENUE_TARGET) * 100, 100), [stats.revenue]);
  if (loading) return <div className="p-8 text-gray-500 font-medium">Loading live report analysis…</div>;
  if (error) return <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"><div className="flex items-center gap-2 font-semibold"><AlertCircle size={18} />Dashboard could not load</div><p className="mt-2 text-sm">{error}</p><button onClick={() => void fetchLiveData()} className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white">Retry connection</button></div>;

  return <div className="min-h-screen space-y-6 bg-[#f8f9fb] p-4 font-sans text-gray-800 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold text-gray-900">Report Analysis</h1><p className="mt-1 text-sm text-gray-500">Sales, orders, customers and product performance.</p></div><button onClick={() => void fetchLiveData(true)} disabled={refreshing} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />{refreshing ? 'Refreshing…' : 'Refresh live data'}</button></div>
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="Total Sales" value={peso(stats.sales)} /><StatCard title="Total Orders" value={stats.orders.toLocaleString()} /><StatCard title="Total Revenue" value={peso(stats.revenue)} /><StatCard title="Total Customers" value={stats.customers.toLocaleString()} /></div>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm xl:col-span-2"><h2 className="mb-5 font-semibold">Revenue Timeline</h2><div className="h-[260px]">{revenueData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={revenueData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/><XAxis dataKey="name" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `₱${Number(v) / 1000}k`}/><Tooltip formatter={(v: any) => peso(Number(v))}/><Line type="monotone" dataKey="current" stroke="#10b981" strokeWidth={2.5} dot={false}/></LineChart></ResponsiveContainer> : <Empty>No order data yet.</Empty>}</div></section>
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"><h2 className="font-semibold">Sales by Location</h2><div className="mt-6 space-y-4">{locationData.length ? locationData.map((loc) => <div key={loc.city}><div className="mb-1 flex justify-between gap-2 text-xs text-gray-500"><span>{loc.city}</span><span>{peso(loc.value)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-violet-600" style={{ width: `${Math.min(loc.percent, 100)}%` }}/></div></div>) : <Empty>No location data.</Empty>}</div></section>
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"><h2 className="font-semibold">Sales Channels</h2><div className="h-[160px]">{channelData.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={channelData} innerRadius={42} outerRadius={62} paddingAngle={2} dataKey="value" stroke="none">{channelData.map((entry) => <Cell key={entry.name} fill={entry.color}/>)}</Pie><Tooltip formatter={(v: any) => peso(Number(v))}/></PieChart></ResponsiveContainer> : <Empty>No channel data.</Empty>}</div><div className="space-y-2">{channelData.map((item) => <div key={item.name} className="flex justify-between gap-2 text-xs"><span className="flex items-center gap-2 text-gray-500"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }}/>{item.name}</span><span className="font-medium">{peso(item.value)}</span></div>)}</div></section>
    </div>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3"><section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm xl:col-span-2"><div className="border-b border-gray-100 p-5"><h2 className="font-semibold">Top Selling Products</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="bg-gray-50 text-xs text-gray-400"><tr>{['Product','Unit Price','Category','Total Sold','Revenue'].map((h) => <th key={h} className="p-4 font-medium">{h}</th>)}</tr></thead><tbody className="text-sm">{topProducts.length ? topProducts.map((p) => <tr key={p.name + p.category} className="border-t border-gray-50"><td className="p-4 font-medium">{p.name}</td><td className="p-4">{peso(p.price)}</td><td className="p-4">{p.category}</td><td className="p-4">{p.qty} units</td><td className="p-4 font-semibold text-emerald-600">{peso(p.revenue)}</td></tr>) : <tr><td colSpan={5} className="p-8 text-center text-gray-400">No products sold yet.</td></tr>}</tbody></table></div></section>
    <section className="rounded-xl border border-gray-100 bg-white p-5 text-center shadow-sm"><h2 className="font-semibold">Monthly Target</h2><p className="mb-5 mt-1 text-xs text-gray-400">Goal: {peso(MONTHLY_REVENUE_TARGET)}</p><div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full" style={{ background: `conic-gradient(#7c3aed ${targetProgress * 3.6}deg, #f3f4f6 0deg)` }}><div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-2xl font-bold">{targetProgress.toFixed(1)}%</div></div><p className="mt-4 text-sm text-gray-500">Revenue so far: {peso(stats.revenue)}</p><div className="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-left"><div><p className="text-xs text-gray-400">Orders</p><p className="font-semibold">{stats.orders}</p></div><div><p className="text-xs text-gray-400">Remaining</p><p className="font-semibold">{peso(Math.max(MONTHLY_REVENUE_TARGET - stats.revenue, 0))}</p></div></div></section></div>
  </div>;
};

function StatCard({ title, value }: { title: string; value: string }) { return <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"><p className="mb-2 text-sm text-gray-500">{title}</p><p className="text-2xl font-bold text-gray-900">{value}</p><div className="mt-3 flex items-center gap-1 text-xs font-medium text-emerald-600"><ArrowUp size={12}/> Current total</div></div>; }
function Empty({ children }: { children: React.ReactNode }) { return <div className="flex h-full min-h-12 items-center justify-center text-center text-sm text-gray-400">{children}</div>; }
export default Dashboard;
