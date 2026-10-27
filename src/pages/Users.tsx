import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import UserDetail from './UserDetail';

export interface UserNode {
  id: string;
  fullName: string;
  username: string;
  email: string;
  mobile?: string;
  birthDate?: string;
  gender?: string;
  age?: number | string;
  facebook?: string;
  status?: string;
  isVerified?: boolean;
  created_at?: string;
  avatar?: string;
}

type Notification = {
  type: 'success' | 'error' | 'warning';
  message: string;
};

const getErrorMessage = (
  error: unknown,
  fallback: string
): string => {
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

const mapUser = (user: any): UserNode => {
  const profile = user.profile ?? {};
  const id = user._id ?? user.id ?? '';

  const fullName =
    [
      profile.firstName ?? profile.first_name ?? '',
      profile.lastName ?? profile.last_name ?? '',
    ]
      .join(' ')
      .trim() ||
    user.fullName ||
    user.full_name ||
    user.name ||
    'Unknown User';

  return {
    ...user,
    id: String(id),
    fullName,
    username:
      user.username ||
      user.email?.split('@')[0] ||
      'user',
    email: user.email || '',
    mobile: profile.mobile || user.mobile || '',
    birthDate:
      profile.birthDate ||
      profile.birth_date ||
      user.birthDate ||
      user.birth_date ||
      '',
    gender: profile.gender || user.gender || '',
    age: user.age,
    facebook: profile.facebook || user.facebook || '',
    avatar: profile.avatar || user.avatar || '',
    status: user.status || user.accountStatus || user.account_status || 'Active',
    isVerified: Boolean(
      user.isVerified ??
        user.is_verified ??
        user.verified ??
        false
    ),
    created_at: user.created_at || user.createdAt || '',
  };
};

const Users: React.FC = () => {
  const [users, setUsers] = useState<UserNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<
    'ALL' | 'VERIFIED' | 'UNVERIFIED'
  >('ALL');
  const [selectedNode, setSelectedNode] = useState<UserNode | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const fetchAllDatabaseNodes = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      setNotification(null);

      const response = await api.get('/api/v1/analytics/users');
      const data = response.data;

      const rawUsers = Array.isArray(data)
        ? data
        : data?.users ?? data?.data ?? data?.results ?? [];

      if (!Array.isArray(rawUsers)) {
        throw new Error('The server returned an invalid users response.');
      }

      const mappedUsers = rawUsers
        .map(mapUser)
        .filter((user: UserNode) => Boolean(user.id));

      setUsers(mappedUsers);

      // Keep the detail screen synchronized with refreshed server data.
      setSelectedNode((current) => {
        if (!current) return null;

        return (
          mappedUsers.find((user) => user.id === current.id) ?? null
        );
      });
    } catch (error) {
      setNotification({
        type: 'error',
        message: `Unable to load users: ${getErrorMessage(
          error,
          'Check your connection and administrator permissions.'
        )}`,
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    void fetchAllDatabaseNodes();
  }, [fetchAllDatabaseNodes]);

  useEffect(() => {
    if (!notification) return;

    const timer = window.setTimeout(() => setNotification(null), 5000);

    return () => window.clearTimeout(timer);
  }, [notification]);

  const handleToggleVerification = async (nodeId: string) => {
    if (!nodeId || pendingActionId) return;

    const previousUsers = users;
    const previousSelectedNode = selectedNode;

    try {
      setNotification(null);
      setPendingActionId(nodeId);

      // Optimistic update while the API request is in progress.
      setUsers((previous) =>
        previous.map((user) =>
          user.id === nodeId ? { ...user, isVerified: true } : user
        )
      );

      setSelectedNode((previous) =>
        previous?.id === nodeId
          ? { ...previous, isVerified: true }
          : previous
      );

      const response = await api.patch(
        `/api/v1/auth/verify/${encodeURIComponent(nodeId)}`
      );

      const data = response.data;

      if (
        data?.status &&
        String(data.status).toUpperCase() !== 'SUCCESS'
      ) {
        throw new Error(data.message || 'The server rejected verification.');
      }

      setNotification({
        type: 'success',
        message: 'User account successfully verified.',
      });

      // Reload canonical data from the server.
      await fetchAllDatabaseNodes(true);
    } catch (error) {
      setUsers(previousUsers);
      setSelectedNode(previousSelectedNode);

      setNotification({
        type: 'error',
        message: `Verification failed: ${getErrorMessage(
          error,
          'Unable to verify this user.'
        )}`,
      });
    } finally {
      setPendingActionId(null);
    }
  };

  const handleTerminateNode = async (nodeId: string) => {
    if (!nodeId || pendingActionId) return;

    const previousUsers = users;
    const previousSelectedNode = selectedNode;

    try {
      setNotification(null);
      setPendingActionId(nodeId);

      // Remove the user from the visible list immediately.
      setUsers((previous) =>
        previous.filter((user) => user.id !== nodeId)
      );

      setSelectedNode((previous) =>
        previous?.id === nodeId ? null : previous
      );

      const response = await api.delete(
        `/api/v1/analytics/users/${encodeURIComponent(nodeId)}`
      );

      const data = response.data;

      if (
        data?.status &&
        String(data.status).toUpperCase() !== 'SUCCESS'
      ) {
        throw new Error(data.message || 'The server rejected deletion.');
      }

      setNotification({
        type: 'warning',
        message: 'User account has been permanently deleted.',
      });

      await fetchAllDatabaseNodes(true);
    } catch (error) {
      // Restore the previous UI if the API operation fails.
      setUsers(previousUsers);
      setSelectedNode(previousSelectedNode);

      setNotification({
        type: 'error',
        message: `Delete failed: ${getErrorMessage(
          error,
          'Unable to delete this user.'
        )}`,
      });
    } finally {
      setPendingActionId(null);
    }
  };

  const systemMetrics = useMemo(() => {
    const total = users.length;
    const verified = users.filter((user) => user.isVerified).length;
    const verifiedPercent =
      total > 0 ? Math.round((verified / total) * 100) : 0;

    const activeConnections = users.filter(
      (user) => user.status?.toLowerCase() === 'active'
    ).length;

    return {
      total,
      verified,
      verifiedPercent,
      activeConnections,
    };
  }, [users]);

  const filteredNodes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        user.username?.toLowerCase().includes(query) ||
        user.fullName?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query);

      const matchesFilter =
        filterType === 'ALL'
          ? true
          : filterType === 'VERIFIED'
            ? user.isVerified === true
            : user.isVerified !== true;

      return Boolean(matchesSearch && matchesFilter);
    });
  }, [users, searchQuery, filterType]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center space-y-4">
        <div
          className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="Loading users"
        />
        <span className="text-sm text-gray-500 font-medium">
          Loading user directory...
        </span>
      </div>
    );
  }

  if (selectedNode) {
    return (
      <UserDetail
        node={selectedNode}
        onBack={() => setSelectedNode(null)}
        onVerify={() => void handleToggleVerification(selectedNode.id)}
        onDelete={() => void handleTerminateNode(selectedNode.id)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8 font-sans text-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900">
              User Management
            </h1>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              Administer user accounts, verify identities, and manage access seamlessly.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void fetchAllDatabaseNodes(true)}
            disabled={isRefreshing}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh Directory'}
          </button>
        </div>

        {notification && (
          <div
            role={notification.type === 'error' ? 'alert' : 'status'}
            className={`mb-8 p-4 rounded-2xl shadow-sm border-l-4 flex items-center gap-3 text-sm font-bold ${
              notification.type === 'success'
                ? 'bg-green-50 border-green-500 text-green-800'
                : notification.type === 'warning'
                  ? 'bg-amber-50 border-amber-500 text-amber-800'
                  : 'bg-red-50 border-red-500 text-red-800'
            }`}
          >
            {notification.message}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Total Users"
            value={systemMetrics.total.toString()}
          />
          <MetricCard
            title="Verified Percentage"
            value={`${systemMetrics.verifiedPercent}%`}
          />
          <MetricCard
            title="Verified Accounts"
            value={systemMetrics.verified.toString()}
            highlight="blue"
          />
          <MetricCard
            title="Active Status"
            value={systemMetrics.activeConnections.toString()}
            highlight="green"
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <input
              type="search"
              placeholder="Search by name, username, or email..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm font-medium transition-colors"
            />
          </div>

          <select
            value={filterType}
            onChange={(event) =>
              setFilterType(
                event.target.value as 'ALL' | 'VERIFIED' | 'UNVERIFIED'
              )
            }
            className="px-4 py-2.5 bg-white border border-gray-300 rounded-xl shadow-sm text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer sm:w-auto w-full"
          >
            <option value="ALL">All Users</option>
            <option value="VERIFIED">Verified Only</option>
            <option value="UNVERIFIED">Unverified Only</option>
          </select>
        </div>

        <div className="space-y-3">
          {filteredNodes.length > 0 ? (
            filteredNodes.map((node) => (
              <button
                type="button"
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className="w-full text-left bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex items-center gap-4 relative overflow-hidden group shadow-sm"
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors ${
                    node.isVerified ? 'bg-indigo-600' : 'bg-gray-300'
                  }`}
                />

                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center overflow-hidden shrink-0 border border-indigo-100 shadow-sm">
                  {node.avatar ? (
                    <img
                      src={node.avatar}
                      alt={`${node.fullName}'s avatar`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-black text-indigo-600">
                      {node.fullName
                        ? node.fullName.charAt(0).toUpperCase()
                        : 'U'}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 truncate group-hover:text-indigo-700 transition-colors text-base">
                    {node.fullName || 'Unknown User'}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium truncate mt-0.5">
                    @{node.username || 'unknown'} • {node.email || 'No email'}
                  </p>
                </div>

                <div className="hidden sm:flex shrink-0 gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      node.isVerified
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {node.isVerified ? 'Verified' : 'Unverified'}
                  </span>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      node.status?.toLowerCase() === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {node.status || 'Unknown'}
                  </span>
                </div>

                <div className="shrink-0 text-gray-400 group-hover:text-indigo-600 transition-colors pr-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            ))
          ) : (
            <div className="py-16 bg-white border border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-500 text-sm font-semibold shadow-sm">
              <svg
                className="w-12 h-12 text-gray-300 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              No users found matching your search criteria.
            </div>
          )}
        </div>

        {pendingActionId && (
          <p className="mt-4 text-sm text-gray-500" role="status">
            Processing account action...
          </p>
        )}
      </div>
    </div>
  );
};

const MetricCard = ({
  title,
  value,
  highlight = 'default',
}: {
  title: string;
  value: string;
  highlight?: 'default' | 'blue' | 'green';
}) => {
  const colorMap = {
    default: 'text-gray-900',
    blue: 'text-indigo-600',
    green: 'text-green-600',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">
        {title}
      </div>
      <div className={`text-3xl font-black mt-2 ${colorMap[highlight]}`}>
        {value}
      </div>
    </div>
  );
};

export default Users;