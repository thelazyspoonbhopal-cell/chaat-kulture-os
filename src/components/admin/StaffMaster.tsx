import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { usersRepo } from '../../lib/dal/usersRepo';
import { authSecurity } from '../../lib/security/authSecurity';
import type { UserProfile, UserRole, Location } from '../../types';
import {
  Users,
  Plus,
  Shield,
  MapPin,
  Check,
  Edit2,
  Trash2,
  Search,
  Building2,
  Store,
  ChefHat,
  Lock,
  Phone,
  Mail,
  UserCheck,
  UserX,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export const StaffMaster: React.FC = () => {
  const { locations, currentRole, showToast, refreshData, currentUser, setCurrentUser } = useApp();
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignLocModalOpen, setIsAssignLocModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);

  // Form State
  const [editingUserId, setEditingUserId] = useState<string>('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('outlet_staff');
  const [formPin, setFormPin] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formAssignedLocIds, setFormAssignedLocIds] = useState<string[]>([]);
  const [formIsActive, setFormIsActive] = useState(true);

  const isSuperAdmin = currentRole === 'owner';
  const canManageStaff = currentRole === 'owner' || currentRole === 'manager';

  const loadUsers = async () => {
    try {
      const data = await usersRepo.getAll();
      setUsersList(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load staff list', 'error');
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const resetForm = () => {
    setEditingUserId('');
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('outlet_staff');
    setFormPin('');
    setFormNotes('');
    setFormAssignedLocIds(['loc_shah_03']); // default to first outlet
    setFormIsActive(true);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (user: UserProfile) => {
    setEditingUserId(user.id);
    setFormName(user.full_name);
    setFormPhone(user.phone || '');
    setFormEmail(user.email || '');
    setFormPassword('');
    setFormRole(user.role);
    setFormPin(user.pin_hash || '');
    setFormNotes(user.notes || '');
    setFormAssignedLocIds(
      user.assigned_location_ids && user.assigned_location_ids.length > 0
        ? user.assigned_location_ids
        : user.assigned_location_id
        ? [user.assigned_location_id]
        : []
    );
    setFormIsActive(user.is_active);
    setIsEditModalOpen(true);
  };

  const handleOpenQuickAssign = (user: UserProfile) => {
    setEditingUserId(user.id);
    setFormName(user.full_name);
    setFormAssignedLocIds(
      user.assigned_location_ids && user.assigned_location_ids.length > 0
        ? user.assigned_location_ids
        : user.assigned_location_id
        ? [user.assigned_location_id]
        : []
    );
    setIsAssignLocModalOpen(true);
  };

  const toggleLocationSelection = (locId: string) => {
    setFormAssignedLocIds(prev =>
      prev.includes(locId) ? prev.filter(id => id !== locId) : [...prev, locId]
    );
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Staff full name is required', 'warning');
      return;
    }
    if (!formPhone.trim()) {
      showToast('Contact phone number is required', 'warning');
      return;
    }

    const effectiveLocIds = formAssignedLocIds.length > 0 ? formAssignedLocIds : ['loc_shah_03'];

    if (!formEmail.trim()) {
      showToast('Login email address or username is required', 'warning');
      return;
    }

    if (!editingUserId && !formPassword.trim()) {
      showToast('Initial login password is required for new accounts', 'warning');
      return;
    }

    try {
      let passwordUpdates: { password_salt?: string; password_hash?: string; plain_password?: string } = {};
      if (formPassword.trim()) {
        const salt = authSecurity.generateSalt();
        const hash = await authSecurity.hashPassword(formPassword.trim(), salt);
        passwordUpdates = { password_salt: salt, password_hash: hash, plain_password: formPassword.trim() };
      }

      if (editingUserId) {
        // Update existing user
        await usersRepo.update(editingUserId, {
          full_name: formName.trim(),
          phone: formPhone.trim(),
          email: formEmail.trim().toLowerCase(),
          role: formRole,
          pin_hash: formPin.trim() || undefined,
          notes: formNotes.trim() || undefined,
          assigned_location_ids: effectiveLocIds,
          assigned_location_id: effectiveLocIds[0],
          is_active: formIsActive,
          ...passwordUpdates,
        } as any);
        showToast(`Staff member "${formName}" updated successfully`, 'success');
        setIsEditModalOpen(false);
      } else {
        // Add new user
        await usersRepo.add({
          business_id: 'biz_chaatkulture_01',
          full_name: formName.trim(),
          phone: formPhone.trim(),
          email: formEmail.trim().toLowerCase(),
          role: formRole,
          pin_hash: formPin.trim() || undefined,
          notes: formNotes.trim() || undefined,
          assigned_location_ids: effectiveLocIds,
          assigned_location_id: effectiveLocIds[0],
          is_active: formIsActive,
          ...passwordUpdates,
        } as any);
        showToast(`Staff member "${formName}" added successfully`, 'success');
        setIsAddModalOpen(false);
      }

      await loadUsers();
      await refreshData();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to save staff member', 'error');
    }
  };

  const handleSaveQuickAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formAssignedLocIds.length === 0) {
      showToast('Staff member must be assigned to at least one outlet', 'warning');
      return;
    }

    try {
      await usersRepo.assignLocations(editingUserId, formAssignedLocIds);
      showToast(`Updated assigned outlets for ${formName}`, 'success');
      setIsAssignLocModalOpen(false);
      await loadUsers();
      await refreshData();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to update assigned outlets', 'error');
    }
  };

  const handleToggleActive = async (user: UserProfile) => {
    if (user.id === 'usr_owner') {
      showToast('Cannot deactivate root Super Admin account', 'warning');
      return;
    }
    try {
      await usersRepo.update(user.id, { is_active: !user.is_active });
      showToast(
        `${user.full_name} is now ${!user.is_active ? 'Active' : 'Inactive'}`,
        !user.is_active ? 'success' : 'info'
      );
      await loadUsers();
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle status', 'error');
    }
  };

  const handleDeleteStaff = async () => {
    if (!deletingUser) return;
    try {
      await usersRepo.delete(deletingUser.id);
      showToast(`Staff member "${deletingUser.full_name}" deleted cleanly`, 'success');
      setDeletingUser(null);
      await loadUsers();
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete staff member', 'error');
    }
  };

  // Filtered Users List
  const filteredUsers = usersList.filter(user => {
    const matchesSearch =
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.phone && user.phone.includes(searchQuery)) ||
      (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = selectedRoleFilter === 'all' || user.role === selectedRoleFilter;

    let matchesLoc = true;
    if (selectedLocationFilter !== 'all') {
      const allowed = usersRepo.getAccessibleLocationIds(user, locations);
      matchesLoc = allowed.includes(selectedLocationFilter);
    }

    return matchesSearch && matchesRole && matchesLoc;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return <Badge variant="purple">👑 Super Admin</Badge>;
      case 'manager':
        return <Badge variant="info">👔 Manager</Badge>;
      case 'kitchen_manager':
        return <Badge variant="warning">🍳 Kitchen Manager</Badge>;
      case 'outlet_staff':
        return <Badge variant="default">🏪 Outlet Staff</Badge>;
      default:
        return <Badge>{role}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 md:p-5 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-600/20 text-orange-400 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">Staff & Outlet Access Master</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-slate-800 text-slate-300 border border-slate-700">
              {usersList.length} Team Members
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Control which outlets and kitchens each staff member can view, manage, and access. Staff members strictly see data from their assigned outlets only.
          </p>
        </div>

        {canManageStaff && (
          <Button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md shadow-orange-950/40"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Staff Member</span>
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search staff by full name, phone number, or email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
        </div>

        {/* Role Filter */}
        <div className="w-full sm:w-48">
          <Select
            value={selectedRoleFilter}
            onChange={e => setSelectedRoleFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Roles' },
              { value: 'owner', label: '👑 Super Admin' },
              { value: 'manager', label: '👔 Manager' },
              { value: 'kitchen_manager', label: '🍳 Kitchen Manager' },
              { value: 'outlet_staff', label: '🏪 Outlet Staff' },
            ]}
          />
        </div>

        {/* Location Assignment Filter */}
        <div className="w-full sm:w-56">
          <Select
            value={selectedLocationFilter}
            onChange={e => setSelectedLocationFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Assigned Outlets' },
              ...locations.map(l => ({ value: l.id, label: `${l.name} (${l.code})` })),
            ]}
          />
        </div>
      </div>

      {/* Staff Members Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Member Name & Contact</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Assigned Outlets & Locations</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredUsers.map(user => {
                const isOwnerOrMgr = user.role === 'owner' || user.role === 'manager';
                const assignedLocIds = usersRepo.getAccessibleLocationIds(user, locations);
                const assignedLocs = locations.filter(l => assignedLocIds.includes(l.id));

                return (
                  <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Member Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs shrink-0">
                          {user.full_name
                            .split(' ')
                            .map(n => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>{user.full_name}</span>
                            {currentUser?.id === user.id && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded font-normal">
                                Active Persona
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-500" />
                              {user.phone || 'No phone'}
                            </span>
                            {user.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-500" />
                                {user.email}
                              </span>
                            )}
                          </div>
                          {user.notes && (
                            <p className="text-[10px] text-slate-500 italic mt-0.5 max-w-sm truncate">
                              {user.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3 px-4">{getRoleBadge(user.role)}</td>

                    {/* Assigned Outlets */}
                    <td className="py-3 px-4">
                      {isOwnerOrMgr ? (
                        <div className="flex items-center gap-1.5 text-xs text-orange-400 font-semibold bg-orange-950/40 border border-orange-800/50 rounded-lg px-2.5 py-1 w-fit">
                          <Building2 className="w-3.5 h-3.5" />
                          <span>Global Access (All 4 Units)</span>
                        </div>
                      ) : assignedLocs.length === 0 ? (
                        <span className="text-red-400 font-medium text-xs flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> No outlets assigned (Blocked)
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {assignedLocs.map(loc => {
                            const isKitchen = loc.type === 'base_kitchen';
                            const isStore = loc.type === 'store_room';
                            return (
                              <span
                                key={loc.id}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                  isKitchen
                                    ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
                                    : isStore
                                    ? 'bg-purple-950/40 text-purple-300 border-purple-800/60'
                                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                                }`}
                              >
                                {isKitchen ? (
                                  <ChefHat className="w-3 h-3 text-amber-400" />
                                ) : (
                                  <Store className="w-3 h-3 text-emerald-400" />
                                )}
                                <span>{loc.name}</span>
                                <span className="font-mono text-[9px] text-slate-400">({loc.code})</span>
                              </span>
                            );
                          })}
                          {canManageStaff && (
                            <button
                              onClick={() => handleOpenQuickAssign(user)}
                              className="text-[10px] text-slate-400 hover:text-orange-400 underline ml-1"
                              title="Click to modify assigned outlets"
                            >
                              Edit Outlets
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Active Status */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => canManageStaff && handleToggleActive(user)}
                        disabled={!canManageStaff || user.id === 'usr_owner'}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${
                          user.is_active
                            ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/60 hover:bg-emerald-900/60'
                            : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700'
                        } ${!canManageStaff || user.id === 'usr_owner' ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {user.is_active ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                        <span>{user.is_active ? 'Active' : 'Disabled'}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Switch Simulator to this User */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentUser(user)}
                          title="Simulate session as this user"
                          className="text-[11px] px-2 py-1 text-slate-300 hover:text-orange-400 hover:bg-slate-800"
                        >
                          Simulate
                        </Button>

                        {canManageStaff && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(user)}
                            className="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5"
                            title="Edit Staff Member"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {isSuperAdmin && user.id !== 'usr_owner' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingUser(user)}
                            className="text-slate-400 hover:text-red-400 hover:bg-red-950/30 p-1.5"
                            title="Delete Staff Member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT STAFF MODAL */}
      {(isAddModalOpen || isEditModalOpen) && (
        <Modal
          isOpen={isAddModalOpen || isEditModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setIsEditModalOpen(false);
          }}
          title={isEditModalOpen ? 'Edit Staff Member & Outlet Access' : 'Add New Staff Member'}
        >
          <form onSubmit={handleSaveStaff} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Full Name *"
                placeholder="e.g. Amit Verma"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                required
              />
              <Input
                label="Phone Number *"
                placeholder="e.g. 9826044444"
                value={formPhone}
                onChange={e => setFormPhone(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Login Email or Username *"
                placeholder="e.g. amit@chaatkulture.com or amit"
                type="text"
                value={formEmail}
                onChange={e => setFormEmail(e.target.value)}
                required
              />
              <Input
                label={editingUserId ? "Update Password (Leave blank to keep current)" : "Login Password *"}
                placeholder={editingUserId ? "••••••••••••" : "e.g. Staff@2026"}
                type="text"
                value={formPassword}
                onChange={e => setFormPassword(e.target.value)}
                required={!editingUserId}
              />
            </div>

            <div className="space-y-1">
              <Select
                label="Assigned System Role *"
                value={formRole}
                onChange={e => setFormRole(e.target.value as UserRole)}
                options={[
                  { value: 'outlet_staff', label: '🏪 Outlet Staff (Counter Operations)' },
                  { value: 'kitchen_manager', label: '🍳 Kitchen Manager (Production & Batch Prep)' },
                  { value: 'manager', label: '👔 Manager (Multi-Outlet Oversight)' },
                  ...(isSuperAdmin ? [{ value: 'owner', label: '👑 Owner / Super Admin' }] : []),
                ]}
              />
              <p className="text-[10px] text-slate-500 italic">
                🔒 Security Note: Staff members cannot change or reset their passwords. Only Super Admin has credential management authority.
              </p>
            </div>

            {/* MULTI-OUTLET ASSIGNMENT SECTION */}
            <div className="border border-slate-800 bg-slate-950/70 p-3.5 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-orange-400" />
                    <span>Assigned Outlets & Physical Locations *</span>
                  </label>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Select one or multiple locations. This staff member will{' '}
                    <strong className="text-orange-400">ONLY</strong> have access to data, sales, stock, and challans
                    from these checked locations.
                  </p>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setFormAssignedLocIds(locations.map(l => l.id))}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormAssignedLocIds(locations.filter(l => l.type === 'outlet').map(l => l.id))
                  }
                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/50 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900/60"
                >
                  Both Retail Outlets (Shahpura & 11 No.)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const baseLoc = locations.find(l => l.code === 'BASE-01');
                    if (baseLoc) setFormAssignedLocIds([baseLoc.id]);
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/50 text-amber-300 border border-amber-800/60 hover:bg-amber-900/60"
                >
                  Base Kitchen Only
                </button>
                <button
                  type="button"
                  onClick={() => setFormAssignedLocIds([])}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 hover:bg-slate-700"
                >
                  Clear
                </button>
              </div>

              {/* Location Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {locations.map(loc => {
                  const isChecked = formAssignedLocIds.includes(loc.id);
                  const isKitchen = loc.type === 'base_kitchen';
                  const isStore = loc.type === 'store_room';

                  return (
                    <div
                      key={loc.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleLocationSelection(loc.id)}
                      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') toggleLocationSelection(loc.id); }}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-orange-600/10 border-orange-500/60 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 ${
                          isChecked
                            ? 'bg-orange-600 border-orange-500 text-white'
                            : 'border-slate-700 bg-slate-800'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="text-xs">
                        <div className="font-bold flex items-center gap-1">
                          {isKitchen ? (
                            <ChefHat className="w-3 h-3 text-amber-400" />
                          ) : isStore ? (
                            <Building2 className="w-3 h-3 text-purple-400" />
                          ) : (
                            <Store className="w-3 h-3 text-emerald-400" />
                          )}
                          <span>{loc.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {loc.code} &bull; {loc.type.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {formAssignedLocIds.length === 0 && (
                <p className="text-[11px] text-red-400 font-medium flex items-center gap-1 pt-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Please select at least one outlet for this staff member.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="4-Digit Quick PIN (For POS Login)"
                placeholder="e.g. 1234"
                maxLength={4}
                value={formPin}
                onChange={e => setFormPin(e.target.value)}
              />
              <div className="flex flex-col justify-end">
                <label className="text-xs font-semibold text-slate-400 mb-1.5">Account Status</label>
                <label className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={e => setFormIsActive(e.target.checked)}
                    className="accent-orange-500 w-4 h-4 rounded"
                  />
                  <span className="text-xs font-bold text-white">Active Account (Can Log In)</span>
                </label>
              </div>
            </div>

            <Input
              label="Staff Notes / Designation Details"
              placeholder="e.g. Roving barista, assigned to 11 No. on weekends..."
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                {isEditModalOpen ? 'Save Changes' : 'Create Staff Member'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* QUICK ASSIGN OUTLETS MODAL */}
      {isAssignLocModalOpen && (
        <Modal
          isOpen={isAssignLocModalOpen}
          onClose={() => setIsAssignLocModalOpen(false)}
          title={`Assign Outlets & Locations: ${formName}`}
        >
          <form onSubmit={handleSaveQuickAssign} className="space-y-4">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
              <p className="font-bold text-white flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-orange-400" />
                <span>Multi-Outlet Restriction Engine</span>
              </p>
              <p>
                Staff members assigned to specific outlets will only be allowed to see sales, inventory, daily closings,
                wastage, and inter-outlet challans involving their assigned locations.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">Select Accessible Outlets:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormAssignedLocIds(locations.map(l => l.id))}
                    className="text-orange-400 hover:underline text-[11px]"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormAssignedLocIds([])}
                    className="text-slate-400 hover:underline text-[11px]"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {locations.map(loc => {
                  const isChecked = formAssignedLocIds.includes(loc.id);
                  const isKitchen = loc.type === 'base_kitchen';
                  return (
                    <div
                      key={loc.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleLocationSelection(loc.id)}
                      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') toggleLocationSelection(loc.id); }}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-orange-600/10 border-orange-500/60 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border ${
                            isChecked
                              ? 'bg-orange-600 border-orange-500 text-white'
                              : 'border-slate-700 bg-slate-800'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="font-bold text-xs flex items-center gap-1.5">
                            {isKitchen ? (
                              <ChefHat className="w-3.5 h-3.5 text-amber-400" />
                            ) : (
                              <Store className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                            <span>{loc.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {loc.code} &bull; {loc.address}
                          </span>
                        </div>
                      </div>

                      {isChecked && (
                        <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                          Assigned
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button type="button" variant="ghost" onClick={() => setIsAssignLocModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Update Outlet Access
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingUser && (
        <Modal
          isOpen={!!deletingUser}
          onClose={() => setDeletingUser(null)}
          title="Confirm Delete Staff Member"
        >
          <div className="space-y-4">
            <div className="p-3 bg-red-950/30 border border-red-800/60 rounded-xl text-red-200 text-xs">
              Are you sure you want to permanently delete{' '}
              <strong className="text-white">{deletingUser.full_name}</strong> ({deletingUser.role})? This user will no
              longer be able to access Chaat Kulture OS.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeletingUser(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteStaff}>
                Permanently Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
