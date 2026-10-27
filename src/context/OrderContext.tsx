// src/context/OrderContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import api from '../services/api';

export interface OrderItem {
  id?: string;
  product_id?: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  sku?: string;
  category?: string;
}

export interface ShippingAddress {
  full_name: string;
  phone?: string;
  email?: string;
  address_line1: string;
  address_line2?: string;
  street?: string;
  barangay?: string;
  city: string;
  state?: string;
  region?: string;
  postal_code: string;
  zip_code?: string;
  country: string;
  landmark?: string;
}

export interface Order {
  _id?: string;
  id?: string;
  order_number?: string;
  user_id?: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  items: OrderItem[];
  subtotal: number;
  shipping_fee?: number;
  tax?: number;
  total: number;
  total_amount?: number;
  status: string;
  payment_status: string;
  payment_method?: string;
  shipping_address: ShippingAddress;
  notes?: string;
  estimated_delivery?: string;
  created_at?: string;
  date?: string;
  updated_at?: string;
}

interface OrderContextType {
  orders: Order[];
  isLoading: boolean;
  loading: boolean;
  error: string | null;
  fetchOrders: () => Promise<void>;
  fetchOrderById: (id: string) => Promise<Order>;
  updateOrderStatus: (id: string, status: string) => Promise<Order>;
  deleteOrder: (id: string) => Promise<void>;
}

export const OrderContext = createContext<OrderContextType | undefined>(
  undefined
);

const ORDERS_ENDPOINT = '/api/v1/orders';

const extractErrorMessage = (error: any, fallback: string): string => {
  const data = error?.response?.data;

  if (typeof data?.detail === 'string') return data.detail;
  if (Array.isArray(data?.detail)) {
    return data.detail.map((item: any) => item.msg || '').join(', ');
  }
  if (typeof data?.message === 'string') return data.message;
  if (typeof error?.message === 'string') return error.message;

  return fallback;
};

const unwrapResponse = (responseData: any): any => {
  let data = responseData?.data ?? responseData ?? {};

  if (data?.data && !data?.orders && !data?.order) {
    data = data.data;
  }

  return data;
};

const normalizeOrderData = (order: any): Order => {
  const rawShipping =
    order.shippingAddress ?? order.shipping_address ?? {};

  const shipping: ShippingAddress = {
    full_name:
      rawShipping.full_name ??
      rawShipping.fullName ??
      order.shipping_full_name ??
      order.customer_name ??
      'Unknown Customer',
    phone:
      rawShipping.phone ??
      order.shipping_mobile_number ??
      order.customer_phone ??
      '',
    email:
      rawShipping.email ??
      order.shipping_email ??
      order.customer_email ??
      '',
    address_line1:
      rawShipping.address_line1 ??
      rawShipping.street ??
      order.shipping_street ??
      '',
    address_line2:
      rawShipping.address_line2 ??
      order.shipping_barangay ??
      order.shipping_landmark ??
      '',
    street: rawShipping.street ?? order.shipping_street ?? '',
    barangay: rawShipping.barangay ?? order.shipping_barangay ?? '',
    city: rawShipping.city ?? order.shipping_city ?? '',
    state:
      rawShipping.state ??
      rawShipping.region ??
      order.shipping_region ??
      '',
    region: rawShipping.region ?? order.shipping_region ?? '',
    postal_code:
      rawShipping.postal_code ??
      rawShipping.zip_code ??
      order.shipping_zip_code ??
      '',
    zip_code: rawShipping.zip_code ?? order.shipping_zip_code ?? '',
    country:
      rawShipping.country ??
      order.shipping_country ??
      'Philippines',
    landmark: rawShipping.landmark ?? order.shipping_landmark ?? '',
  };

  const id = String(order._id ?? order.id ?? '');
  const total = Number(order.total ?? order.total_amount ?? 0);
  const subtotal = Number(order.subtotal ?? total);
  const orderDate =
    order.created_at ?? order.createdAt ?? order.date ?? '';

  return {
    ...order,
    id,
    _id: id,
    order_number:
      order.order_number ?? (id ? id.slice(-8).toUpperCase() : ''),
    total,
    total_amount: total,
    subtotal,
    shipping_fee: Number(order.shipping_fee ?? order.shippingFee ?? 0),
    tax: Number(order.tax ?? 0),
    items: Array.isArray(order.items) ? order.items : [],
    customer_name:
      order.customer_name ??
      order.customerName ??
      shipping.full_name,
    customer_email:
      order.customer_email ??
      order.customerEmail ??
      shipping.email,
    customer_phone:
      order.customer_phone ??
      order.customerPhone ??
      shipping.phone,
    status: String(order.status ?? 'pending').toLowerCase(),
    payment_status: String(
      order.payment_status ?? order.paymentStatus ?? 'pending'
    ).toLowerCase(),
    payment_method:
      order.payment_method ?? order.paymentMethod ?? 'cash_on_delivery',
    shipping_address: shipping,
    created_at: orderDate,
    date: orderDate,
  };
};

const getOrderList = (responseData: any): any[] => {
  const data = unwrapResponse(responseData);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.orders)) return data.orders;
  if (Array.isArray(data?.items)) return data.items;

  return [];
};

let activeFetchPromise: Promise<any> | null = null;

export const OrderProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('access_token');

    if (!token) {
      setOrders([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (!activeFetchPromise) {
        activeFetchPromise = api
          .get(ORDERS_ENDPOINT, { timeout: 15000 })
          .then((response) => response.data);
      }

      const data = await activeFetchPromise;
      setOrders(getOrderList(data).map(normalizeOrderData));
    } catch (err: any) {
      const message = extractErrorMessage(err, 'Failed to fetch orders.');
      console.error('[OrderContext] Fetch failed:', message);
      setError(message);
    } finally {
      activeFetchPromise = null;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();

    return () => {
      // Requests may finish after this provider unmounts.
      // The shared request itself is intentionally not aborted here.
    };
  }, [fetchOrders]);

  const fetchOrderById = useCallback(async (id: string): Promise<Order> => {
    if (!id || id === 'undefined') {
      throw new Error('A valid order ID is required.');
    }

    try {
      const response = await api.get(
        `${ORDERS_ENDPOINT}/${encodeURIComponent(id)}`,
        { timeout: 15000 }
      );

      const data = unwrapResponse(response.data);
      const order = normalizeOrderData(data?.order ?? data);

      setOrders((previous) => {
        const exists = previous.some(
          (item) => item.id === order.id || item._id === order.id
        );

        return exists
          ? previous.map((item) =>
              item.id === order.id || item._id === order.id
                ? order
                : item
            )
          : [order, ...previous];
      });

      return order;
    } catch (err: any) {
      throw new Error(
        extractErrorMessage(err, 'Failed to fetch order details.')
      );
    }
  }, []);

  const updateOrderStatus = useCallback(
    async (id: string, status: string): Promise<Order> => {
      try {
        const response = await api.patch(
          `${ORDERS_ENDPOINT}/${encodeURIComponent(id)}/status`,
          { status },
          { timeout: 15000 }
        );

        const data = unwrapResponse(response.data);
        const updated = normalizeOrderData(data?.order ?? data);

        const updatedOrder = {
          ...updated,
          status: updated.status || status.toLowerCase(),
        };

        setOrders((previous) =>
          previous.map((item) =>
            item.id === id || item._id === id
              ? { ...item, ...updatedOrder }
              : item
          )
        );

        return updatedOrder;
      } catch (err: any) {
        throw new Error(
          extractErrorMessage(err, 'Failed to update order status.')
        );
      }
    },
    []
  );

  const deleteOrder = useCallback(async (id: string): Promise<void> => {
    try {
      await api.delete(
        `${ORDERS_ENDPOINT}/${encodeURIComponent(id)}`,
        { timeout: 15000 }
      );

      setOrders((previous) =>
        previous.filter((order) => order.id !== id && order._id !== id)
      );
    } catch (err: any) {
      throw new Error(
        extractErrorMessage(err, 'Failed to delete order.')
      );
    }
  }, []);

  return (
    <OrderContext.Provider
      value={{
        orders,
        isLoading,
        loading: isLoading,
        error,
        fetchOrders,
        fetchOrderById,
        updateOrderStatus,
        deleteOrder,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};

export const useOrders = () => {
  const context = useContext(OrderContext);

  if (!context) {
    throw new Error('useOrders must be used within an OrderProvider');
  }

  return context;
};

export default OrderProvider;