import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { db, initializeDatabaseDefaults } from '../lib/db';
import { locationsRepo } from '../lib/dal/locationsRepo';
import { sandboxRepo } from '../lib/dal/sandboxRepo';
import { rbacRepo } from '../lib/dal/rbacRepo';
import { usersRepo } from '../lib/dal/usersRepo';
import { authRepo } from '../lib/dal/authRepo';
import { sessionBus } from '../lib/security/sessionChannel';
import { syncEngine, type SyncEngineStatus } from '../lib/sync/syncEngine';
import type { Location, UserRole, UserProfile, UserSession, AppPermissionKey, RolePermissionConfig } from '../types';

interface ToastInfo {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface AppContextType {
  isAuthenticated: boolean;
  activeSession: UserSession | null;
  currentRole: UserRole;
  currentUser: UserProfile | null;
  users: UserProfile[];
  currentLocation: Location | null;
  locations: Location[];
  accessibleLocations: Location[];
  activeTab: string;
  isTestMode: boolean;
  isOnline: boolean;
  isUnassignedStaff: boolean;
  syncStatus: SyncEngineStatus;
  triggerSync: () => Promise<void>;
  roleConfigs: RolePermissionConfig[];
  demoStats: {
    demoMenu: number;
    realMenu: number;
    demoInv: number;
    realInv: number;
    demoSuppliers: number;
    realSuppliers: number;
    demoSales: number;
    hasDemoData: boolean;
  };
  toasts: ToastInfo[];
  isSandboxModalOpen: boolean;
  login: (user: UserProfile, session: UserSession) => void;
  logout: () => Promise<void>;
  setRole: (role: UserRole) => void;
  setCurrentUser: (user: UserProfile) => void;
  setLocation: (location: Location) => void;
  isLocationAccessible: (locationId: string) => boolean;
  setActiveTab: (tab: string) => void;
  setIsSandboxModalOpen: (open: boolean) => void;
  canAccess: (permissionKey: AppPermissionKey) => boolean;
  updateRolePermission: (role: UserRole, key: AppPermissionKey, enabled: boolean) => Promise<void>;
  resetRolePermissions: () => Promise<void>;
  loadDemoData: () => Promise<void>;
  purgeDemoData: () => Promise<void>;
  refreshData: () => Promise<void>;
  showToast: (message: string, type?: ToastInfo['type']) => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeSession, setActiveSession] = useState<UserSession | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>('owner');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isTestMode, setIsTestMode] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSandboxModalOpen, setIsSandboxModalOpen] = useState<boolean>(false);
  const [roleConfigs, setRoleConfigs] = useState<RolePermissionConfig[]>([]);
  const [toasts, setToasts] = useState<ToastInfo[]>([]);
  const [demoStats, setDemoStats] = useState({
    demoMenu: 0,
    realMenu: 0,
    demoInv: 0,
    realInv: 0,
    demoSuppliers: 0,
    realSuppliers: 0,
    demoSales: 0,
    hasDemoData: false,
  });

  const showToast = useCallback((message: string, type: ToastInfo['type'] = 'info') => {
    const id = 'toast_' + Date.now() + Math.random().toString(36).substr(2, 4);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Compute strictly accessible locations for the current user and role
  const accessibleLocations = useMemo(() => {
    if (!currentUser) return locations;
    const allowedIds = usersRepo.getAccessibleLocationIds(currentUser, locations);
    return locations.filter(l => allowedIds.includes(l.id));
  }, [currentUser, locations]);

  // Check if a specific location ID is accessible by the current user
  const isLocationAccessible = useCallback(
    (locationId: string): boolean => {
      if (!currentUser) return true;
      if (currentUser.role === 'owner' || currentUser.role === 'manager') return true;
      const allowedIds = usersRepo.getAccessibleLocationIds(currentUser, locations);
      return allowedIds.includes(locationId);
    },
    [currentUser, locations]
  );

  // Refresh all state from Dexie, RBAC, and Users
  const refreshData = useCallback(async () => {
    try {
      await initializeDatabaseDefaults();
      const [allLocs, allUsers] = await Promise.all([
        locationsRepo.getAll(),
        usersRepo.getAll(),
      ]);

      setLocations(allLocs);
      setUsers(allUsers);

      // Initialize / Verify currentUser and active authenticated session
      const active = await authRepo.getActiveSession();
      let effectiveUser = currentUser;

      if (active && active.session.is_active) {
        setIsAuthenticated(true);
        setActiveSession(active.session);
        setCurrentUser(active.user);
        setCurrentRole(active.user.role);
        effectiveUser = active.user;

        // Auto-navigate to allowed landing view if currently on dashboard or admin
        if (active.user.role === 'outlet_staff') {
          setActiveTab(prev => (prev === 'dashboard' || prev === 'admin' ? 'sales' : prev));
        } else if (active.user.role === 'kitchen_manager') {
          setActiveTab(prev => (prev === 'dashboard' || prev === 'admin' ? 'kitchen' : prev));
        }
      } else {
        setIsAuthenticated(false);
        setActiveSession(null);
        if (!effectiveUser && allUsers.length > 0) {
          effectiveUser = allUsers.find(u => u.role === 'owner') || allUsers[0];
          setCurrentUser(effectiveUser);
          setCurrentRole(effectiveUser.role);
        } else if (effectiveUser) {
          const freshUser = allUsers.find(u => u.id === effectiveUser?.id);
          if (freshUser) {
            effectiveUser = freshUser;
            setCurrentUser(freshUser);
          }
        }
      }

      // Default location setup aligned with user's accessible locations
      const userAllowedIds = usersRepo.getAccessibleLocationIds(effectiveUser, allLocs);
      const userAllowedLocs = allLocs.filter(l => userAllowedIds.includes(l.id));

      if (userAllowedLocs.length > 0) {
        if (!currentLocation || !userAllowedIds.includes(currentLocation.id)) {
          setCurrentLocation(userAllowedLocs[0]);
        }
      } else if (allLocs.length > 0 && !currentLocation) {
        if (effectiveUser?.role === 'owner' || effectiveUser?.role === 'manager') {
          const defaultLoc = allLocs.find(l => l.code === 'BASE-01') || allLocs[0];
          setCurrentLocation(defaultLoc);
        } else {
          // Explicit zero-fallback: unassigned staff are not silently assigned to Shahpura
          setCurrentLocation(null);
        }
      }

      // Load RBAC permission matrix
      const rbacList = await rbacRepo.getAll();
      setRoleConfigs(rbacList);

      const stats = await sandboxRepo.getStats();
      setDemoStats(stats);
      setIsTestMode(stats.hasDemoData);
    } catch (err) {
      console.error('Error refreshing app context:', err);
    }
  }, [currentLocation, currentUser]);

  useEffect(() => {
    refreshData();

    // Listen to network status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshData]);

  // Keep currentLocation aligned with accessibleLocations whenever permissions or user changes
  useEffect(() => {
    if (accessibleLocations.length > 0 && currentLocation) {
      const isStillAccessible = accessibleLocations.some(l => l.id === currentLocation.id);
      if (!isStillAccessible) {
        setCurrentLocation(accessibleLocations[0]);
      }
    }
  }, [accessibleLocations, currentLocation]);

  // Check if active user role has a specific permission
  const canAccess = useCallback((permissionKey: AppPermissionKey): boolean => {
    // If authenticated user is NOT owner, enforce their real DB role, preventing simulator privilege escalation
    const effectiveRole = currentUser && currentUser.role !== 'owner' ? currentUser.role : currentRole;

    // Owner (Super Admin) always has root access to everything
    if (effectiveRole === 'owner') return true;

    const currentConfig = roleConfigs.find(c => c.role === effectiveRole);
    if (!currentConfig) return false;
    return !!currentConfig.permissions[permissionKey];
  }, [currentRole, currentUser, roleConfigs]);

  // Super Admin updates a role permission
  const handleUpdateRolePermission = async (role: UserRole, key: AppPermissionKey, enabled: boolean) => {
    try {
      const updated = await rbacRepo.updatePermission(role, key, enabled);
      setRoleConfigs(updated);
      showToast(`Updated ${key} permission for ${role} to ${enabled ? 'Enabled' : 'Disabled'}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update permission', 'error');
    }
  };

  // Super Admin resets all permissions to default
  const handleResetRolePermissions = async () => {
    try {
      const defaults = await rbacRepo.resetToDefaults();
      setRoleConfigs(defaults);
      showToast('Restored all role permissions to factory defaults', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to reset permissions', 'error');
    }
  };

  const handleSetRole = (role: UserRole) => {
    // Production Security Guard: Only Super Admin can simulate or switch roles
    if (currentUser && currentUser.role !== 'owner') {
      showToast('Role switching is restricted to the Super Admin.', 'error');
      return;
    }

    setCurrentRole(role);
    // Find matching persona user from users list
    const matchingUser = users.find(u => u.role === role);
    if (matchingUser) {
      setCurrentUser(matchingUser);
      const userLocIds = usersRepo.getAccessibleLocationIds(matchingUser, locations);
      const userLocs = locations.filter(l => userLocIds.includes(l.id));
      if (userLocs.length > 0 && (!currentLocation || !userLocIds.includes(currentLocation.id))) {
        setCurrentLocation(userLocs[0]);
      }
    } else {
      // Fallback location alignment
      if (role === 'kitchen_manager') {
        const baseLoc = locations.find(l => l.code === 'BASE-01');
        if (baseLoc) setCurrentLocation(baseLoc);
      } else if (role === 'outlet_staff' && currentLocation?.code === 'BASE-01') {
        const shahpura = locations.find(l => l.code === 'SHAH-03');
        if (shahpura) setCurrentLocation(shahpura);
      }
    }
    showToast(`Switched active simulator role to: ${role.toUpperCase()}`, 'info');
  };

  const handleSetUser = (user: UserProfile) => {
    setCurrentUser(user);
    setCurrentRole(user.role);
    const userLocIds = usersRepo.getAccessibleLocationIds(user, locations);
    const userLocs = locations.filter(l => userLocIds.includes(l.id));
    if (userLocs.length > 0 && (!currentLocation || !userLocIds.includes(currentLocation.id))) {
      setCurrentLocation(userLocs[0]);
    }
    const locNames = userLocs.map(l => l.name).join(', ') || 'All Locations';
    showToast(`Active User: ${user.full_name} (${user.role.toUpperCase()}) — Assigned Outlets: [${locNames}]`, 'info');
  };

  const handleSetLocation = (loc: Location) => {
    // Restrict if user is not authorized for this location
    if (currentUser && currentUser.role !== 'owner' && currentUser.role !== 'manager') {
      const allowedIds = usersRepo.getAccessibleLocationIds(currentUser, locations);
      if (!allowedIds.includes(loc.id)) {
        showToast(`Access Denied: ${currentUser.full_name} is not assigned to ${loc.name} (${loc.code})`, 'error');
        return;
      }
    }
    setCurrentLocation(loc);
    showToast(`Active location set to: ${loc.name} (${loc.code})`, 'info');
  };

  const handleLoadDemoData = async () => {
    try {
      await sandboxRepo.loadDemoData();
      await refreshData();
      showToast('Demo data loaded successfully! (Tagged with is_demo: true)', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to load demo data', 'error');
    }
  };

  const handlePurgeDemoData = async () => {
    try {
      await sandboxRepo.purgeDemoData();
      await refreshData();
      showToast('Demo data purged cleanly! Real master data & 4 locations preserved.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to purge demo data', 'error');
    }
  };

  // Track whether staff account has zero assigned outlets (Explicit unassigned guard)
  const isUnassignedStaff = Boolean(
    isAuthenticated &&
    currentUser &&
    currentUser.role === 'outlet_staff' &&
    accessibleLocations.length === 0
  );

  // Automated Sync Engine State Integration
  const [syncStatus, setSyncStatus] = useState<SyncEngineStatus>(syncEngine.getStatus());

  useEffect(() => {
    const unsub = syncEngine.subscribe(setSyncStatus);
    return unsub;
  }, []);

  const handleTriggerSync = useCallback(async () => {
    const res = await syncEngine.triggerSync('manual');
    if (res.success) {
      showToast('Replication complete across active database tiers', 'success');
    } else {
      showToast(res.message, 'warning');
    }
  }, [showToast]);

  const handleLogin = (user: UserProfile, session: UserSession) => {
    setIsAuthenticated(true);
    setActiveSession(session);
    setCurrentUser(user);
    setCurrentRole(user.role);
    if (user.role === 'outlet_staff') {
      setActiveTab('sales');
    } else if (user.role === 'kitchen_manager') {
      setActiveTab('kitchen');
    } else {
      setActiveTab('dashboard');
    }
    showToast(`Welcome back, ${user.full_name}! Active session started.`, 'success');
  };

  const handleLogout = async () => {
    try {
      await authRepo.logout(activeSession?.id);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsAuthenticated(false);
      setActiveSession(null);
      setActiveTab('sales'); // Reset tab so next login doesn't get trapped in admin
      showToast('You have been securely signed out.', 'info');
    }
  };

  // Instant Single-Device Eviction via sessionBus and Realtime Cloud Bus
  useEffect(() => {
    if (!isAuthenticated || !currentUser || !activeSession) return;

    // 1. Cross-tab/window instant eviction bus (<10ms)
    const unsubscribeBus = sessionBus.subscribe(msg => {
      if (msg.type === 'CONCURRENT_LOGIN') {
        if (msg.userId === currentUser.id && msg.newSessionId !== activeSession.id) {
          setIsAuthenticated(false);
          setActiveSession(null);
          showToast(`Your session was terminated because this account logged in on another device (${msg.deviceName}).`, 'error');
        }
      }
    });

    // 2. Cross-device Realtime Cloud eviction (Supabase)
    const unsubscribeCloud = sessionBus.listenToCloudRevocations(currentUser.id, reason => {
      setIsAuthenticated(false);
      setActiveSession(null);
      showToast(`Your session was terminated: ${reason.replace(/_/g, ' ')}`, 'error');
    });

    // 3. Fallback database polling (every 2 seconds)
    const interval = setInterval(async () => {
      const active = await authRepo.getActiveSession();
      if (!active || !active.session.is_active) {
        setIsAuthenticated(false);
        setActiveSession(null);
        showToast('Your session was terminated because this account logged in on another device.', 'error');
      }
    }, 2000);

    return () => {
      unsubscribeBus();
      unsubscribeCloud();
      clearInterval(interval);
    };
  }, [isAuthenticated, currentUser, activeSession, showToast]);

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        activeSession,
        currentRole,
        currentUser,
        users,
        currentLocation,
        locations,
        accessibleLocations,
        activeTab,
        isTestMode,
        isOnline,
        isUnassignedStaff,
        syncStatus,
        triggerSync: handleTriggerSync,
        roleConfigs,
        demoStats,
        toasts,
        isSandboxModalOpen,
        login: handleLogin,
        logout: handleLogout,
        setRole: handleSetRole,
        setCurrentUser: handleSetUser,
        setLocation: handleSetLocation,
        isLocationAccessible,
        setActiveTab,
        setIsSandboxModalOpen,
        canAccess,
        updateRolePermission: handleUpdateRolePermission,
        resetRolePermissions: handleResetRolePermissions,
        loadDemoData: handleLoadDemoData,
        purgeDemoData: handlePurgeDemoData,
        refreshData,
        showToast,
        dismissToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
