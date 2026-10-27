// src/pages/Promos.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Tag,
  Calendar,
  Plus,
  Trash2,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  Settings,
  Save,
  CheckCircle2,
  Percent,
  Gamepad2,
  Clock,
  CheckSquare,
  Square,
} from 'lucide-react';

import api, { apiErrorMessage } from '../services/api';

interface Coupon {
  id?: string;
  _id?: string;
  code: string;
  discount: number;
  type: string;
  minSpend?: number;
  description: string;
  is_game_reward?: boolean;
  source?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  expires_at?: string;
  expiresAt?: string;
  expiry_date?: string;
  valid_until?: string;
  gained_at?: string;
  gainedAt?: string;
  issued_at?: string;
  issuedAt?: string;
}

interface EventItem {
  id?: string;
  _id?: string;
  title: string;
  description: string;
  event_type: string;
  discount_amount: number;
  start_date: string;
  end_date: string;
  status: string;
  is_featured: boolean;
}

interface TaxResponse {
  taxRate?: number;
  tax_rate?: number;
}

const API_PREFIX = '/api/v1';

const getErrorMessage = (error: unknown, fallback: string): string => {
  const message = apiErrorMessage(error);
  return message || fallback;
};

const getList = <T,>(data: unknown, key: string): T[] => {
  if (Array.isArray(data)) {
    return data as T[];
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;

    if (Array.isArray(record[key])) {
      return record[key] as T[];
    }

    if (Array.isArray(record.data)) {
      return record.data as T[];
    }

    if (Array.isArray(record.items)) {
      return record.items as T[];
    }
  }

  return [];
};

const getTaxRate = (data: TaxResponse): number | null => {
  const rate = data?.taxRate ?? data?.tax_rate;
  return typeof rate === 'number' && Number.isFinite(rate) ? rate : null;
};

const formatDate = (value: string): string => {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleString();
};

const pickCouponDate = (coupon: Coupon, keys: (keyof Coupon)[]): string | null => {
  for (const key of keys) {
    const val = coupon[key];
    if (typeof val === 'string' && val.trim()) {
      return val;
    }
  }
  return null;
};

const isGameCoupon = (coupon: Coupon): boolean =>
  Boolean(
    coupon.is_game_reward ||
      coupon.source === 'game' ||
      String(coupon.code).startsWith('EGB-')
  );

const couponKey = (coupon: Coupon): string =>
  String(coupon.code || coupon.id || coupon._id || '').toUpperCase();

const Promos: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'coupons' | 'events' | 'tax'>(
    'coupons'
  );

  const [couponSubFilter, setCouponSubFilter] = useState<
    'all' | 'store' | 'game'
  >('all');

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const [taxRateInput, setTaxRateInput] = useState<string>('8');
  const [isSavingTax, setIsSavingTax] = useState<boolean>(false);
  const [taxSuccess, setTaxSuccess] = useState<string | null>(null);
  const [taxError, setTaxError] = useState<string | null>(null);

  const [isSavingCoupon, setIsSavingCoupon] = useState(false);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'coupon' | 'event' | 'bulk-coupons' | null;
    idOrCode: string;
    title: string;
    codes?: string[];
  }>({
    isOpen: false,
    type: null,
    idOrCode: '',
    title: '',
  });

  const [couponForm, setCouponForm] = useState({
    code: '',
    discount: 10,
    type: 'percent',
    minSpend: 0,
    description: '',
  });

  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    event_type: 'sale',
    discount_amount: 100,
    start_date: '',
    end_date: '',
    status: 'upcoming',
    is_featured: false,
  });

  const [showCouponModal, setShowCouponModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      if (activeTab === 'coupons') {
        try {
          const [storeCouponsRes, gameCouponsRes] = await Promise.all([
            api
              .get(`${API_PREFIX}/coupons`, { timeout: 15000 })
              .catch(() => ({ data: [] })),
            api
              .get(`${API_PREFIX}/game/coupons`, { timeout: 15000 })
              .catch(() => ({ data: [] })),
          ]);

          const storeList = getList<Coupon>(storeCouponsRes.data, 'coupons').map(
            (c) => ({
              ...c,
              is_game_reward: Boolean(
                c.is_game_reward ||
                  c.source === 'game' ||
                  String(c.code).startsWith('EGB-')
              ),
              source:
                c.source ||
                (String(c.code).startsWith('EGB-') ? 'game' : 'store'),
            })
          );

          const gameList = getList<Coupon>(gameCouponsRes.data, 'coupons').map(
            (c) => ({
              ...c,
              is_game_reward: true,
              source: 'game',
            })
          );

          const combinedMap = new Map<string, Coupon>();
          [...storeList, ...gameList].forEach((c) => {
            if (c?.code) {
              combinedMap.set(c.code.toUpperCase(), c);
            }
          });

          setCoupons(Array.from(combinedMap.values()));
          setSelectedCodes(new Set());
        } catch (err: any) {
          if (err?.response?.status === 404) {
            setCoupons([]);
          } else {
            throw err;
          }
        }
      } else if (activeTab === 'events') {
        try {
          const response = await api.get(`${API_PREFIX}/events`, {
            timeout: 15000,
          });
          setEvents(getList<EventItem>(response.data, 'events'));
        } catch (err: any) {
          if (err?.response?.status === 404) {
            setEvents([]);
          } else {
            throw err;
          }
        }
      } else {
        try {
          const response = await api.get<TaxResponse>(`${API_PREFIX}/tax`, {
            timeout: 15000,
          });

          const rate = getTaxRate(response.data);
          if (rate !== null) {
            setTaxRateInput(String(rate <= 1 ? rate * 100 : rate));
          }
        } catch (err: any) {
          if (err?.response?.status === 404) {
            setTaxRateInput('8');
          } else {
            throw err;
          }
        }
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load data from the backend.'));
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    setSelectedCodes(new Set());
  }, [couponSubFilter]);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSavingCoupon(true);

    try {
      await api.post(
        `${API_PREFIX}/coupons`,
        {
          ...couponForm,
          code: couponForm.code.trim().toUpperCase(),
        },
        { timeout: 15000 }
      );

      setShowCouponModal(false);
      setCouponForm({
        code: '',
        discount: 10,
        type: 'percent',
        minSpend: 0,
        description: '',
      });

      await fetchData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create coupon.'));
    } finally {
      setIsSavingCoupon(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSavingEvent(true);

    if (
      new Date(eventForm.end_date).getTime() <
      new Date(eventForm.start_date).getTime()
    ) {
      setError('The event end date must be after the start date.');
      setIsSavingEvent(false);
      return;
    }

    try {
      await api.post(`${API_PREFIX}/events`, eventForm, { timeout: 15000 });

      setShowEventModal(false);
      setEventForm({
        title: '',
        description: '',
        event_type: 'sale',
        discount_amount: 100,
        start_date: '',
        end_date: '',
        status: 'upcoming',
        is_featured: false,
      });

      await fetchData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create event.'));
    } finally {
      setIsSavingEvent(false);
    }
  };

  const handleSaveTaxRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTax(true);
    setTaxSuccess(null);
    setTaxError(null);

    const numericValue = Number(taxRateInput);

    if (
      taxRateInput.trim() === '' ||
      !Number.isFinite(numericValue) ||
      numericValue < 0 ||
      numericValue > 100
    ) {
      setTaxError('Please enter a valid percentage between 0 and 100.');
      setIsSavingTax(false);
      return;
    }

    try {
      const payloadRate = numericValue / 100;

      await api.put(
        `${API_PREFIX}/tax`,
        { taxRate: payloadRate },
        { timeout: 15000 }
      );

      setTaxSuccess(
        'Tax rate updated successfully! Cart totals will now reflect this rate.'
      );
    } catch (err: unknown) {
      setTaxError(getErrorMessage(err, 'Failed to save the tax rate.'));
    } finally {
      setIsSavingTax(false);
    }
  };

  const confirmDelete = async () => {
    const { type, idOrCode, codes } = deleteModal;
    if (!type || isDeleting) return;

    setError('');
    setIsDeleting(true);

    try {
      if (type === 'coupon') {
        if (!idOrCode) return;
        await api.delete(
          `${API_PREFIX}/coupons/${encodeURIComponent(idOrCode)}`,
          { timeout: 15000 }
        );
      } else if (type === 'bulk-coupons') {
        const toDelete = codes && codes.length > 0 ? codes : [];
        if (toDelete.length === 0) return;

        const failures: string[] = [];
        for (const code of toDelete) {
          try {
            await api.delete(
              `${API_PREFIX}/coupons/${encodeURIComponent(code)}`,
              { timeout: 15000 }
            );
          } catch {
            failures.push(code);
          }
        }

        if (failures.length > 0) {
          setError(
            `Deleted ${toDelete.length - failures.length} coupon(s). Failed: ${failures.join(', ')}`
          );
        }
      } else {
        if (!idOrCode) return;
        await api.delete(
          `${API_PREFIX}/events/${encodeURIComponent(idOrCode)}`,
          { timeout: 15000 }
        );
      }

      setDeleteModal({
        isOpen: false,
        type: null,
        idOrCode: '',
        title: '',
      });
      setSelectedCodes(new Set());
      await fetchData();
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          type === 'bulk-coupons'
            ? 'Failed to delete selected coupons.'
            : `Failed to delete ${type}.`
        )
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredCoupons = useMemo(() => {
    return coupons.filter((coupon) => {
      const isGame = isGameCoupon(coupon);
      if (couponSubFilter === 'game') return isGame;
      if (couponSubFilter === 'store') return !isGame;
      return true;
    });
  }, [coupons, couponSubFilter]);

  const storeCouponsCount = coupons.filter((c) => !isGameCoupon(c)).length;
  const gameCouponsCount = coupons.filter((c) => isGameCoupon(c)).length;

  const filteredKeys = useMemo(
    () => filteredCoupons.map(couponKey).filter(Boolean),
    [filteredCoupons]
  );

  const allFilteredSelected =
    filteredKeys.length > 0 &&
    filteredKeys.every((k) => selectedCodes.has(k));

  const someFilteredSelected = filteredKeys.some((k) => selectedCodes.has(k));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedCodes((prev) => {
        const next = new Set(prev);
        filteredKeys.forEach((k) => next.delete(k));
        return next;
      });
    } else {
      setSelectedCodes((prev) => {
        const next = new Set(prev);
        filteredKeys.forEach((k) => next.add(k));
        return next;
      });
    }
  };

  const toggleSelectOne = (code: string) => {
    const key = code.toUpperCase();
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openBulkDelete = () => {
    const codes = Array.from(selectedCodes);
    if (codes.length === 0) return;

    setDeleteModal({
      isOpen: true,
      type: 'bulk-coupons',
      idOrCode: '',
      title:
        codes.length === 1
          ? `Coupon (${codes[0]})`
          : `${codes.length} selected coupons`,
      codes,
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 bg-white text-slate-900 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border border-slate-200 p-6 rounded-xl shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-200 text-slate-700 text-xs font-medium mb-2">
            <Sparkles className="w-3.5 h-3.5 text-slate-600" />
            Promotions &amp; Events Command
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Promos &amp; Campaign Manager
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Manage discount coupons, game reward vouchers, schedule storewide
            sales, and customize taxes.
          </p>
        </div>

        <div>
          {activeTab === 'coupons' && (
            <button
              type="button"
              onClick={() => setShowCouponModal(true)}
              className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create Coupon
            </button>
          )}

          {activeTab === 'events' && (
            <button
              type="button"
              onClick={() => setShowEventModal(true)}
              className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Schedule Event
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('coupons')}
          className={
            'px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ' +
            (activeTab === 'coupons'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
          }
        >
          <Tag className="w-3.5 h-3.5" />
          Discount Coupons ({coupons.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('events')}
          className={
            'px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ' +
            (activeTab === 'events'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
          }
        >
          <Calendar className="w-3.5 h-3.5" />
          Store Events &amp; Sales ({events.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tax')}
          className={
            'px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ' +
            (activeTab === 'tax'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
          }
        >
          <Settings className="w-3.5 h-3.5" />
          Tax Configuration
        </button>
      </div>

      {activeTab === 'coupons' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-fit">
            <button
              type="button"
              onClick={() => setCouponSubFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                couponSubFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All Coupons ({coupons.length})
            </button>
            <button
              type="button"
              onClick={() => setCouponSubFilter('store')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                couponSubFilter === 'store'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Store Promos ({storeCouponsCount})
            </button>
            <button
              type="button"
              onClick={() => setCouponSubFilter('game')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                couponSubFilter === 'game'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              <Gamepad2 size={14} />
              Game Rewards ({gameCouponsCount})
            </button>
          </div>

          {!loading && filteredCoupons.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer"
              >
                {allFilteredSelected ? (
                  <CheckSquare className="w-3.5 h-3.5 text-slate-900" />
                ) : someFilteredSelected ? (
                  <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-slate-400" />
                )}
                {allFilteredSelected ? 'Deselect all' : 'Select all'}
                <span className="text-slate-400 font-normal">
                  ({filteredKeys.length})
                </span>
              </button>

              {selectedCodes.size > 0 && (
                <button
                  type="button"
                  onClick={openBulkDelete}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-all cursor-pointer shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove selected ({selectedCodes.size})
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="ml-auto underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs">
          Loading data...
        </div>
      ) : activeTab === 'coupons' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCoupons.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
              No coupons found matching this filter category.
            </div>
          ) : (
            filteredCoupons.map((coupon, idx) => {
              const isGameReward = isGameCoupon(coupon);
              const key = couponKey(coupon);
              const isSelected = selectedCodes.has(key);

              const createdOrGained = pickCouponDate(coupon, [
                'gained_at',
                'gainedAt',
                'issued_at',
                'issuedAt',
                'created_at',
                'createdAt',
              ]);
              const expires = pickCouponDate(coupon, [
                'expires_at',
                'expiresAt',
                'expiry_date',
                'valid_until',
              ]);

              return (
                <div
                  key={coupon.id || coupon._id || coupon.code || idx}
                  className={`bg-white border p-5 rounded-xl flex flex-col justify-between shadow-xs transition-all relative ${
                    isSelected
                      ? 'border-slate-900 ring-2 ring-slate-900/10'
                      : isGameReward
                        ? 'border-amber-200 bg-amber-50/10'
                        : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleSelectOne(coupon.code)}
                          className="shrink-0 p-0.5 rounded text-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
                          title={isSelected ? 'Deselect' : 'Select'}
                          aria-label={
                            isSelected
                              ? `Deselect ${coupon.code}`
                              : `Select ${coupon.code}`
                          }
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-slate-900" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                        <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-900 font-mono font-bold text-xs tracking-wider border border-slate-200 truncate">
                          {coupon.code}
                        </span>
                        {isGameReward && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase tracking-wider border border-amber-300 shrink-0">
                            <Gamepad2 size={11} /> Game Reward
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteModal({
                            isOpen: true,
                            type: 'coupon',
                            idOrCode: coupon.code,
                            title: `Coupon (${coupon.code})`,
                          })
                        }
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                        title="Delete Coupon"
                        aria-label={`Delete coupon ${coupon.code}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 mb-1">
                      {coupon.type === 'percent'
                        ? `${coupon.discount}% OFF`
                        : `₱${coupon.discount} OFF`}
                    </h3>
                    <p className="text-xs text-slate-500 mb-3">
                      {coupon.description ||
                        (isGameReward
                          ? 'Won from minigame activity'
                          : 'No description provided.')}
                    </p>

                    {(createdOrGained || expires) && (
                      <div className="mb-3 space-y-1 text-[11px] text-slate-500">
                        {createdOrGained && (
                          <div className="flex items-start gap-1.5">
                            <Clock className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" />
                            <span>
                              {isGameReward ? 'Gained' : 'Created'}:{' '}
                              <span className="font-mono text-slate-700">
                                {formatDate(createdOrGained)}
                              </span>
                            </span>
                          </div>
                        )}
                        {expires && (
                          <div className="flex items-start gap-1.5">
                            <Calendar className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" />
                            <span>
                              Expires:{' '}
                              <span className="font-mono text-slate-700">
                                {formatDate(expires)}
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>
                      Min. Spend:{' '}
                      <strong className="text-slate-900">
                        ₱{coupon.minSpend ?? 0}
                      </strong>
                    </span>
                    <span className="uppercase text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {coupon.type || 'fixed'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : activeTab === 'events' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
              No events scheduled in backend. Create a flash sale or
              promotional campaign.
            </div>
          ) : (
            events.map((event, idx) => (
              <div
                key={event.id || event._id || idx}
                className="bg-white border border-slate-200 p-5 rounded-xl flex flex-col justify-between hover:border-slate-300 shadow-xs transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px] uppercase tracking-wider border border-slate-200">
                        {event.event_type}
                      </span>

                      <span
                        className={
                          'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ' +
                          (event.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : event.status === 'ended'
                              ? 'bg-slate-200 text-slate-600'
                              : 'bg-amber-100 text-amber-800')
                        }
                      >
                        {event.status}
                      </span>

                      {event.is_featured && (
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase border border-indigo-200">
                          Featured
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setDeleteModal({
                          isOpen: true,
                          type: 'event',
                          idOrCode: event.id || event._id || '',
                          title: event.title,
                        })
                      }
                      disabled={!event.id && !event._id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-40"
                      title="Delete Event"
                      aria-label={`Delete event ${event.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-1">
                    {event.title}
                  </h3>
                  <p className="text-xs text-slate-500 mb-4 line-clamp-2">
                    {event.description || 'No description provided.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <strong className="text-emerald-600 font-bold">
                      ₱{event.discount_amount || 0} OFF
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>From:</span>
                    <span className="font-mono text-slate-700">
                      {formatDate(event.start_date)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Until:</span>
                    <span className="font-mono text-slate-700">
                      {formatDate(event.end_date)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs max-w-2xl">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5 mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-900">
              <Settings size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Tax Configuration
              </h2>
              <p className="text-xs text-slate-500 font-light">
                Customize the global tax rate applied across customer checkouts.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveTaxRate} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Global Tax Rate (%)
              </label>

              <div className="relative flex items-center max-w-xs">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={taxRateInput}
                  onChange={(e) => setTaxRateInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-slate-900 text-slate-900 text-sm font-medium px-4 py-3 rounded-xl outline-none transition-all pr-10"
                  placeholder="8"
                />
                <div className="absolute right-4 text-slate-400 pointer-events-none">
                  <Percent size={16} />
                </div>
              </div>
            </div>

            {taxError && (
              <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-xl">
                <AlertCircle size={16} className="shrink-0" />
                <span>{taxError}</span>
              </div>
            )}

            {taxSuccess && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{taxSuccess}</span>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={isSavingTax}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <Save size={16} />
                <span>
                  {isSavingTax ? 'Saving Changes...' : 'Save Tax Setting'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {showCouponModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 mb-4">
              Create Discount Coupon
            </h3>

            <form onSubmit={handleCreateCoupon} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Coupon Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BACKYARD10"
                  value={couponForm.code}
                  onChange={(e) =>
                    setCouponForm({
                      ...couponForm,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 text-xs focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Discount Value
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={couponForm.discount}
                    onChange={(e) =>
                      setCouponForm({
                        ...couponForm,
                        discount: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 text-xs focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Type
                  </label>
                  <select
                    value={couponForm.type}
                    onChange={(e) =>
                      setCouponForm({
                        ...couponForm,
                        type: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 text-xs focus:outline-none focus:border-slate-900"
                  >
                    <option value="percent">Percent (%)</option>
                    <option value="fixed">Fixed (₱)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Minimum Spend (₱)
                </label>
                <input
                  type="number"
                  min="0"
                  value={couponForm.minSpend}
                  onChange={(e) =>
                    setCouponForm({
                      ...couponForm,
                      minSpend: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 text-xs focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Special backyard sale"
                  value={couponForm.description}
                  onChange={(e) =>
                    setCouponForm({
                      ...couponForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 text-xs focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCouponModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingCoupon}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSavingCoupon ? 'Saving...' : 'Save Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEventModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 mb-4">
              Schedule Store Event / Sale
            </h3>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Backyard Anniversary Sale"
                  value={eventForm.title}
                  onChange={(e) =>
                    setEventForm({
                      ...eventForm,
                      title: e.target.value,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 text-xs focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Event Type
                  </label>
                  <select
                    value={eventForm.event_type}
                    onChange={(e) =>
                      setEventForm({
                        ...eventForm,
                        event_type: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 text-xs focus:outline-none focus:border-slate-900"
                  >
                    <option value="sale">Sale / Discount</option>
                    <option value="live_stream">Live Stream</option>
                    <option value="holiday">Holiday Campaign</option>
                    <option value="launch">Product Launch</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Discount Amount (PHP)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-500 font-bold">
                      ₱
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={eventForm.discount_amount}
                      onChange={(e) =>
                        setEventForm({
                          ...eventForm,
                          discount_amount: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-7 pr-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-slate-900 font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Status
                  </label>
                  <select
                    value={eventForm.status}
                    onChange={(e) =>
                      setEventForm({
                        ...eventForm,
                        status: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 text-xs focus:outline-none focus:border-slate-900"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="active">Active</option>
                    <option value="ended">Ended</option>
                  </select>
                </div>

                <div className="pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eventForm.is_featured}
                      onChange={(e) =>
                        setEventForm({
                          ...eventForm,
                          is_featured: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-700 uppercase">
                      Featured Event
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Start Date
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={eventForm.start_date}
                    onChange={(e) =>
                      setEventForm({
                        ...eventForm,
                        start_date: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    End Date
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={eventForm.end_date}
                    onChange={(e) =>
                      setEventForm({
                        ...eventForm,
                        end_date: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Event details and rules..."
                  value={eventForm.description}
                  onChange={(e) =>
                    setEventForm({
                      ...eventForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 text-xs focus:outline-none focus:border-slate-900 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingEvent}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSavingEvent ? 'Saving...' : 'Schedule Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                Confirm Deletion
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {deleteModal.type === 'bulk-coupons' ? (
                  <>
                    Are you sure you want to delete{' '}
                    <strong className="text-slate-900">
                      {deleteModal.codes?.length ?? 0} coupon
                      {(deleteModal.codes?.length ?? 0) === 1 ? '' : 's'}
                    </strong>
                    ? This action cannot be undone.
                  </>
                ) : (
                  <>
                    Are you sure you want to delete{' '}
                    <strong className="text-slate-900">
                      {deleteModal.title}
                    </strong>
                    ? This action cannot be undone.
                  </>
                )}
              </p>
              {deleteModal.type === 'bulk-coupons' &&
                deleteModal.codes &&
                deleteModal.codes.length > 0 &&
                deleteModal.codes.length <= 8 && (
                  <p className="text-[11px] text-slate-400 mt-2 font-mono break-all">
                    {deleteModal.codes.join(', ')}
                  </p>
                )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() =>
                  setDeleteModal({
                    isOpen: false,
                    type: null,
                    idOrCode: '',
                    title: '',
                  })
                }
                className="flex-1 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void confirmDelete()}
                className="flex-1 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Promos;
