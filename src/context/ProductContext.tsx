import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import api, { apiErrorMessage } from '../services/api';

export interface Product {
  _id?: string;
  id?: string;
  name: string;
  description: string;
  price: number;
  compare_at_price?: number | null;
  sku: string;
  inventory: number;
  category: 'rooster' | 'hen' | 'chick' | string;
  badge?: string | null;
  sizes: string[];
  colors: string[];
  images: string[];
  specifications: Record<string, any>;
  status: string;
  created_at?: string;
  updated_at?: string;
}

interface ProductContextType {
  products: Product[];
  isLoading: boolean;
  loading: boolean;
  error: string | null;
  fetchProducts: () => Promise<void>;
  fetchProductById: (id: string) => Promise<Product>;
  createProduct: (productData: Partial<Product>) => Promise<Product>;
  updateProduct: (
    id: string,
    productData: Partial<Product>
  ) => Promise<Product>;
  deleteProduct: (id: string) => Promise<void>;
}

const PRODUCTS_ENDPOINT = '/api/v1/products';

export const ProductContext = createContext<
  ProductContextType | undefined
>(undefined);

const unwrapResponse = (responseData: any): any => {
  let data = responseData?.data ?? responseData ?? {};
  if (data?.data && !data?.product && !data?.products) {
    data = data.data;
  }
  return data;
};

const normalizeProduct = (product: any, fallbackId = ''): Product => {
  const id = String(product?._id ?? product?.id ?? fallbackId);

  return {
    ...product,
    _id: id,
    id,
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: Number(product?.price) || 0,
    compare_at_price:
      product?.compare_at_price == null
        ? null
        : Number(product.compare_at_price),
    sku: product?.sku ?? '',
    inventory: Number(
      product?.inventory ?? product?.stock ?? product?.quantity ?? 0
    ),
    category: product?.category ?? 'chick',
    badge: product?.badge ?? null,
    sizes: Array.isArray(product?.sizes) ? product.sizes : [],
    colors: Array.isArray(product?.colors) ? product.colors : [],
    images: Array.isArray(product?.images)
      ? product.images
      : product?.image
        ? [product.image]
        : [],
    specifications:
      product?.specifications &&
      typeof product.specifications === 'object'
        ? product.specifications
        : {},
    status: product?.status ?? 'active',
    created_at: product?.created_at ?? product?.createdAt,
    updated_at: product?.updated_at ?? product?.updatedAt,
  };
};

const getProductList = (responseData: any): any[] => {
  const data = unwrapResponse(responseData);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

export const ProductProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeFetchRef = useRef<Promise<any> | null>(null);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!activeFetchRef.current) {
        activeFetchRef.current = api
          .get(PRODUCTS_ENDPOINT)
          .then((res) => res.data);
      }

      const data = await activeFetchRef.current;
      const normalized = getProductList(data).map((p) =>
        normalizeProduct(p)
      );
      setProducts(normalized);
    } catch (err: unknown) {
      const message = apiErrorMessage(err, 'Failed to fetch products.');
      setError(message);
      throw new Error(message);
    } finally {
      activeFetchRef.current = null;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProducts().catch(() => {});
  }, [fetchProducts]);

  const fetchProductById = useCallback(
    async (id: string): Promise<Product> => {
      if (!id || id === 'undefined' || id === 'null') {
        throw new Error('Invalid product ID provided.');
      }

      try {
        const url = PRODUCTS_ENDPOINT + '/' + encodeURIComponent(id);
        const response = await api.get(url);
        const data = unwrapResponse(response.data);
        const product = normalizeProduct(data?.product ?? data, id);

        setProducts((prev) => {
          const index = prev.findIndex(
            (p) => p.id === id || p._id === id
          );
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = product;
            return updated;
          }
          return [product, ...prev];
        });

        return product;
      } catch (err: unknown) {
        throw new Error(
          apiErrorMessage(err, 'Failed to fetch product details.')
        );
      }
    },
    []
  );

  const createProduct = useCallback(
    async (productData: Partial<Product>): Promise<Product> => {
      try {
        const response = await api.post(PRODUCTS_ENDPOINT, productData);
        const data = unwrapResponse(response.data);
        const product = normalizeProduct(data?.product ?? data);

        setProducts((prev) => [product, ...prev]);
        return product;
      } catch (err: unknown) {
        throw new Error(
          apiErrorMessage(err, 'Failed to create product.')
        );
      }
    },
    []
  );

  const updateProduct = useCallback(
    async (
      id: string,
      productData: Partial<Product>
    ): Promise<Product> => {
      if (!id || id === 'undefined' || id === 'null') {
        throw new Error('Invalid product ID provided.');
      }

      try {
        const url = PRODUCTS_ENDPOINT + '/' + encodeURIComponent(id);
        const response = await api.put(url, productData);
        const data = unwrapResponse(response.data);
        const product = normalizeProduct(data?.product ?? data, id);

        setProducts((prev) =>
          prev.map((p) =>
            p.id === id || p._id === id ? product : p
          )
        );
        return product;
      } catch (err: unknown) {
        throw new Error(
          apiErrorMessage(err, 'Failed to update product.')
        );
      }
    },
    []
  );

  const deleteProduct = useCallback(async (id: string): Promise<void> => {
    if (!id || id === 'undefined' || id === 'null') {
      throw new Error('Invalid product ID provided.');
    }

    try {
      const url = PRODUCTS_ENDPOINT + '/' + encodeURIComponent(id);
      await api.delete(url);
      setProducts((prev) =>
        prev.filter((p) => p.id !== id && p._id !== id)
      );
    } catch (err: unknown) {
      throw new Error(
        apiErrorMessage(err, 'Failed to delete product.')
      );
    }
  }, []);

  return (
    <ProductContext.Provider
      value={{
        products,
        isLoading,
        loading: isLoading,
        error,
        fetchProducts,
        fetchProductById,
        createProduct,
        updateProduct,
        deleteProduct,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error('useProducts must be used within a ProductProvider');
  }
  return context;
};

export default ProductProvider;