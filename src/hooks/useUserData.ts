import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { User, UserWithSession } from '../types/database';

/**
 * Custom hook for comprehensive user data management
 * Provides various methods to fetch and filter user data from Supabase
 */
export const useUserData = () => {
  const [users, setUsers] = useState<UserWithSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all users with their session data.
   * This method now fetches in chunks of 1000 (the default max) for efficiency.
   * It correctly paginates through the entire user set to retrieve all users.
   */
  const fetchAllUsers = async () => {
    setLoading(true);
    setError(null);
    
    const allUsers: UserWithSession[] = [];
    const fetchSize = 1000; // Use max chunk size for fewer requests
    let offset = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        const { data, error } = await supabase
          .from('users')
          .select(`
            *,
            user_sessions (
              id,
              is_active,
              created_at,
              updated_at
            )
          `)
          .order('created_at', { ascending: false })
          .range(offset, offset + fetchSize - 1);

        if (error) {
          console.error('Error fetching all users:', error);
          throw error;
        }
        
        if (data && data.length > 0) {
          allUsers.push(...data);
          offset += data.length;
        }
        
        hasMore = data?.length === fetchSize;
      }

      setUsers(allUsers);
      return allUsers;
    } catch (err) {
      const errorMessage = 'Failed to fetch users';
      console.error(errorMessage, err);
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch a single user by ID with complete information
   * Returns user data with sessions and analytics events
   */
  const fetchUserById = async (userId: string): Promise<UserWithSession | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          user_sessions (*),
          user_analytics_events (
            id,
            event_type,
            event_category,
            event_action,
            event_path,
            created_at
          )
        `)
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user by ID:', error);
        throw error;
      }

      return data;
    } catch (err) {
      const errorMessage = `Failed to fetch user with ID: ${userId}`;
      console.error(errorMessage, err);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch users with advanced filtering options.
   * This function now paginates through results to ensure all filtered users are returned.
   */
  const fetchUsersWithFilters = async (filters: {
    userType?: 'standard' | 'premium';
    hasActiveSubscription?: boolean;
    hasActiveSession?: boolean;
    searchTerm?: string;
    createdAfter?: string;
    createdBefore?: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('users')
        .select(`
          *,
          user_sessions (*)
        `);

      // Apply user type filter
      if (filters.userType) {
        query = query.eq('user_type', filters.userType);
      }

      // Apply subscription status filter
      if (filters.hasActiveSubscription !== undefined) {
        query = query.eq('has_active_subscription', filters.hasActiveSubscription);
      }

      // Apply date range filters
      if (filters.createdAfter) {
        query = query.gte('created_at', filters.createdAfter);
      }

      if (filters.createdBefore) {
        query = query.lte('created_at', filters.createdBefore);
      }

      // Apply search term across multiple fields
      if (filters.searchTerm) {
        const searchPattern = `%${filters.searchTerm}%`;
        query = query.or(`
          first_name.ilike.${searchPattern},
          last_name.ilike.${searchPattern},
          email.ilike.${searchPattern},
          phone.ilike.${searchPattern}
        `);
      }
      
      const allFilteredUsers: UserWithSession[] = [];
      const fetchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + fetchSize - 1);

        if (error) {
          console.error('Error fetching filtered users:', error);
          throw error;
        }

        if (data && data.length > 0) {
          allFilteredUsers.push(...data);
          offset += data.length;
        }

        hasMore = data?.length === fetchSize;
      }


      let filteredData = allFilteredUsers;

      // Apply active session filter (post-query filtering since it requires JOIN logic)
      if (filters.hasActiveSession !== undefined) {
        filteredData = filteredData.filter(user => {
          const hasActiveSession = user.user_sessions?.some((session: any) => session.is_active);
          return filters.hasActiveSession ? hasActiveSession : !hasActiveSession;
        });
      }

      setUsers(filteredData);
      return filteredData;
    } catch (err) {
      const errorMessage = 'Failed to fetch filtered users';
      console.error(errorMessage, err);
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch users with pagination support
   * Includes total count for pagination controls
   */
  const fetchUsersPaginated = async (
    page: number = 0,
    pageSize: number = 50,
    orderBy: string = 'created_at',
    ascending: boolean = false
  ) => {
    setLoading(true);
    setError(null);

    try {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('users')
        .select(`
          *,
          user_sessions (*)
        `, { count: 'exact' })
        .order(orderBy, { ascending })
        .range(from, to);

      if (error) {
        console.error('Error fetching paginated users:', error);
        throw error;
      }

      const result = {
        users: data || [],
        totalCount: count || 0,
        currentPage: page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
        hasMore: (count || 0) > to + 1,
        hasPrevious: page > 0
      };

      setUsers(result.users);
      return result;
    } catch (err) {
      const errorMessage = 'Failed to fetch paginated users';
      console.error(errorMessage, err);
      setError(errorMessage);
      return {
        users: [],
        totalCount: 0,
        currentPage: page,
        pageSize,
        totalPages: 0,
        hasMore: false,
        hasPrevious: false
      };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch user statistics and aggregated data.
   * This now fetches all records in batches to ensure accuracy.
   * NOTE: For very large tables, calculating stats on the client is inefficient.
   * Consider using database functions (RPC) for better performance.
   */
  const fetchUserStatistics = async () => {
    setLoading(true);
    setError(null);

    try {
      const allUsersData = [];
      const fetchSize = 1000;
      let offset = 0;
      let hasMore = true;

      // Fetch all users in chunks
      while (hasMore) {
        const { data, error } = await supabase
          .from('users')
          .select('user_type, has_active_subscription, created_at')
          .range(offset, offset + fetchSize - 1);

        if (error) {
          console.error('Error fetching user statistics:', error);
          throw error;
        }

        if (data && data.length > 0) {
          allUsersData.push(...data);
          offset += data.length;
        }
        hasMore = data?.length === fetchSize;
      }
      
      const allActiveSessions = [];
      offset = 0; // Reset for next fetch
      hasMore = true; // Reset for next fetch

      // Fetch all active sessions in chunks
      while (hasMore) {
        const { data, error } = await supabase
          .from('user_sessions')
          .select('user_id')
          .eq('is_active', true)
          .range(offset, offset + fetchSize - 1);
        
        if (error) {
          console.error('Error fetching active sessions:', error);
          throw error;
        }

        if (data && data.length > 0) {
          allActiveSessions.push(...data);
          offset += data.length;
        }
        hasMore = data?.length === fetchSize;
      }

      const users = allUsersData;
      const uniqueActiveUsers = new Set(allActiveSessions.map(s => s.user_id)).size;

      // Calculate statistics
      const statistics = {
        totalUsers: users.length,
        activeUsers: uniqueActiveUsers,
        standardUsers: users.filter(u => u.user_type === 'standard').length,
        premiumUsers: users.filter(u => u.user_type === 'premium').length,
        subscribedUsers: users.filter(u => u.has_active_subscription).length,
        unsubscribedUsers: users.filter(u => !u.has_active_subscription).length,
        newUsersThisMonth: users.filter(u => {
          const userDate = new Date(u.created_at);
          const now = new Date();
          const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
          return userDate >= monthAgo;
        }).length,
        subscriptionRate: users.length > 0
          ? (users.filter(u => u.has_active_subscription).length / users.length * 100).toFixed(1)
          : '0',
        activeUserRate: users.length > 0
          ? (uniqueActiveUsers / users.length * 100).toFixed(1)
          : '0'
      };

      return statistics;
    } catch (err) {
      const errorMessage = 'Failed to fetch user statistics';
      console.error(errorMessage, err);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Search users by email (exact match)
   * Useful for user lookup functionality
   */
  const findUserByEmail = async (email: string): Promise<UserWithSession | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          user_sessions (*)
        `)
        .eq('email', email.toLowerCase())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - user not found
          return null;
        }
        console.error('Error finding user by email:', error);
        throw error;
      }

      return data;
    } catch (err) {
      const errorMessage = `Failed to find user with email: ${email}`;
      console.error(errorMessage, err);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get users who joined within a specific date range.
   * This function now paginates through results to ensure all matching users are returned.
   */
  const fetchUsersByDateRange = async (startDate: string, endDate: string) => {
    setLoading(true);
    setError(null);

    try {
      const query = supabase
        .from('users')
        .select(`
          *,
          user_sessions (*)
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      
      const allUsersInRange = [];
      const fetchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + fetchSize - 1);

        if (error) {
          console.error('Error fetching users by date range:', error);
          throw error;
        }

        if (data && data.length > 0) {
          allUsersInRange.push(...data);
          offset += data.length;
        }
        hasMore = data?.length === fetchSize;
      }

      setUsers(allUsersInRange);
      return allUsersInRange;
    } catch (err) {
      const errorMessage = `Failed to fetch users between ${startDate} and ${endDate}`;
      console.error(errorMessage, err);
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Initialize with all users on mount
  useEffect(() => {
    fetchAllUsers();
  }, []);

  return {
    // State
    users,
    loading,
    error,
    
    // Fetch methods
    fetchAllUsers,
    fetchUserById,
    fetchUsersWithFilters,
    fetchUsersPaginated,
    fetchUserStatistics,
    findUserByEmail,
    fetchUsersByDateRange,
    
    // Utility methods
    clearError: () => setError(null),
    clearUsers: () => setUsers([])
  };
};