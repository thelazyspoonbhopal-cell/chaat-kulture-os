import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { usersRepo } from '../../lib/dal/usersRepo';
import { attendanceRepo } from '../../lib/dal/attendanceRepo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  Calendar,
  Clock,
  UserCheck,
  UserX,
  Users,
  Search,
  CheckCircle2,
  RefreshCw,
  Save,
  Plus,
  Minus,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Store,
  ShieldAlert,
} from 'lucide-react';
import type { UserProfile, StaffAttendanceRecord, AttendanceStatus, Location } from '../../types';

export const StaffAttendanceManager: React.FC = () => {
  const { currentRole, currentUser, locations, showToast } = useApp();

  // Access Control: Only visible to Super Admin / Owner and Manager
  const isAuthorized = currentRole === 'owner' || currentRole === 'manager';

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Map<string, StaffAttendanceRecord>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Role display badges
  const roleBadges: Record<string, { label: string; color: string }> = {
    owner: { label: 'Super Admin', color: 'bg-orange-950/80 text-orange-400 border-orange-800' },
    manager: { label: 'Manager', color: 'bg-blue-950/80 text-blue-400 border-blue-800' },
    kitchen_manager: { label: 'Head Chef / Kitchen', color: 'bg-amber-950/80 text-amber-400 border-amber-800' },
    outlet_staff: { label: 'Outlet Staff', color: 'bg-emerald-950/80 text-emerald-400 border-emerald-800' },
  };

  // Location code helper
  const locMap = useMemo(() => {
    return new Map<string, Location>(locations.map(l => [l.id, l]));
  }, [locations]);

  // Load staff list & attendance for selected date
  const loadData = async (forceSync = false) => {
    setIsLoading(true);
    try {
      if (forceSync) setIsSyncing(true);

      const [allUsers, existingAtt] = await Promise.all([
        usersRepo.getAll(),
        attendanceRepo.getAttendanceForDate(selectedDate, undefined, forceSync),
      ]);

      // Filter active staff (exclude deleted or inactive if marked)
      const activeStaff = allUsers.filter(u => u.is_active !== false);
      setStaffList(activeStaff);

      // Create attendance map
      const map = new Map<string, StaffAttendanceRecord>();
      existingAtt.forEach(a => map.set(a.user_id, a));

      // For any staff member who does not yet have a record for this date, initialize a default 'present' entry
      activeStaff.forEach(u => {
        if (!map.has(u.id)) {
          const defaultLoc = u.assigned_location_id || u.assigned_location_ids?.[0] || 'loc_shah_03';
          map.set(u.id, {
            id: `att_${selectedDate.replace(/-/g, '')}_${u.id}`,
            user_id: u.id,
            user_name: u.full_name,
            role: u.role,
            location_id: defaultLoc,
            date: selectedDate,
            status: 'present',
            overtime_hours: 0,
            check_in_time: '10:00',
            check_out_time: '22:00',
            notes: '',
            updated_at: new Date().toISOString(),
          });
        }
      });

      setAttendanceMap(map);
    } catch (err) {
      console.error('Failed to load attendance:', err);
      showToast('Error loading attendance data', 'error');
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      loadData();
    }
  }, [selectedDate, isAuthorized]);

  // Quick Date Navigation
  const changeDateBy = (days: number) => {
    const curr = new Date(selectedDate);
    curr.setDate(curr.getDate() + days);
    setSelectedDate(curr.toISOString().split('T')[0]);
  };

  const setToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Modify individual staff attendance record
  const updateRecord = (userId: string, updates: Partial<StaffAttendanceRecord>) => {
    setAttendanceMap(prev => {
      const next = new Map(prev);
      const existing = next.get(userId);
      if (existing) {
        next.set(userId, { ...existing, ...updates });
      }
      return next;
    });
  };

  // 1-Click Mark All Present
  const handleMarkAllPresent = async () => {
    const updatedBy = currentUser?.full_name || currentRole;
    setAttendanceMap(prev => {
      const next = new Map(prev);
      next.forEach((rec, userId) => {
        next.set(userId, {
          ...rec,
          status: 'present',
          overtime_hours: 0,
        });
      });
      return next;
    });

    showToast('Marked all staff as Present for ' + selectedDate, 'success');
  };

  // Save Attendance Sheet to IndexedDB & Cloud Gist
  const handleSaveAttendance = async () => {
    setIsSaving(true);
    try {
      const updatedBy = currentUser?.full_name || currentRole;
      const recordsToSave = Array.from(attendanceMap.values());
      await attendanceRepo.saveAttendanceRecords(recordsToSave, updatedBy);
      showToast(`Saved attendance for ${recordsToSave.length} staff members!`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error saving attendance', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered staff list by location and search query
  const filteredStaff = useMemo(() => {
    return staffList.filter(u => {
      const rec = attendanceMap.get(u.id);
      const locId = rec ? rec.location_id : (u.assigned_location_id || u.assigned_location_ids?.[0]);

      const matchesLocation =
        selectedLocationId === 'all' ||
        locId === selectedLocationId ||
        (u.assigned_location_ids && u.assigned_location_ids.includes(selectedLocationId));

      const matchesSearch =
        u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.phone && u.phone.includes(searchTerm));

      return matchesLocation && matchesSearch;
    });
  }, [staffList, attendanceMap, selectedLocationId, searchTerm]);

  // Aggregate Metrics for Selected Date & Location
  const metrics = useMemo(() => {
    let present = 0;
    let halfDay = 0;
    let absent = 0;
    let onLeave = 0;
    let totalOvertimeHours = 0;

    filteredStaff.forEach(u => {
      const rec = attendanceMap.get(u.id);
      if (!rec) return;

      if (rec.status === 'present') present++;
      else if (rec.status === 'half_day') halfDay++;
      else if (rec.status === 'absent') absent++;
      else if (rec.status === 'on_leave') onLeave++;

      totalOvertimeHours += rec.overtime_hours || 0;
    });

    return {
      total: filteredStaff.length,
      present,
      halfDay,
      absent,
      onLeave,
      totalOvertimeHours,
    };
  }, [filteredStaff, attendanceMap]);

  // Restricted Access View
  if (!isAuthorized) {
    return (
      <div className="max-w-md mx-auto my-16 bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-extrabold text-white">Manager & Admin Access Only</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Staff attendance recording, half-day management, and overtime tracking are restricted exclusively to Super Admins and General Managers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-20">
      {/* Top Banner & Title */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-slate-900/60 border border-slate-800 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
              Staff Attendance & Overtime Hub
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            Staff Daily Attendance Sheet
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Log presence, mark half-days, calculate overtime hours, and record staff shift remarks across outlets.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMarkAllPresent}
            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 border-emerald-800/60 bg-emerald-950/30"
            title="Mark everyone on this roster as Present (Full Day)"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Mark All Present</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadData(true)}
            disabled={isSyncing}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-orange-400' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Cloud'}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveAttendance}
            disabled={isSaving}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 font-bold text-xs py-2 px-3.5 shadow-lg flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Sheet'}</span>
          </Button>
        </div>
      </div>

      {/* Date & Location Filter Bar */}
      <div className="p-3 sm:p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
        {/* Date Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
            <button
              onClick={() => changeDateBy(-1)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-850 rounded-lg transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-2.5">
              <Calendar className="w-4 h-4 text-orange-400 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
              />
            </div>
            <button
              onClick={() => changeDateBy(1)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-850 rounded-lg transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={setToday}
            className="text-xs text-orange-400 hover:text-orange-300 py-1.5 px-2.5"
          >
            Today
          </Button>
        </div>

        {/* Location Dropdown & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
            <Store className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <select
              value={selectedLocationId}
              onChange={e => setSelectedLocationId(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">All Outlets & Kitchen</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id} className="bg-slate-900 text-white">
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search staff by name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {/* Total Staff */}
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>Total Staff</span>
          </span>
          <div className="text-xl font-black text-white font-mono">{metrics.total}</div>
          <span className="text-[10px] text-slate-500">Roster active</span>
        </div>

        {/* Present Full Day */}
        <div className="p-3 bg-slate-900 border border-emerald-900/40 rounded-xl space-y-1">
          <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Full Day Present</span>
          </span>
          <div className="text-xl font-black text-emerald-400 font-mono">{metrics.present}</div>
          <span className="text-[10px] text-emerald-500">
            {metrics.total > 0 ? Math.round((metrics.present / metrics.total) * 100) : 0}% attendance
          </span>
        </div>

        {/* Half Day */}
        <div className="p-3 bg-slate-900 border border-amber-900/40 rounded-xl space-y-1">
          <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Half Day Shifts</span>
          </span>
          <div className="text-xl font-black text-amber-400 font-mono">{metrics.halfDay}</div>
          <span className="text-[10px] text-amber-500">0.5 shift credited</span>
        </div>

        {/* Absent */}
        <div className="p-3 bg-slate-900 border border-rose-900/40 rounded-xl space-y-1">
          <span className="text-[11px] font-semibold text-rose-400 flex items-center gap-1">
            <UserX className="w-3.5 h-3.5 text-rose-400" />
            <span>Absent</span>
          </span>
          <div className="text-xl font-black text-rose-400 font-mono">{metrics.absent}</div>
          <span className="text-[10px] text-rose-500">Unexcused absence</span>
        </div>

        {/* Leave */}
        <div className="p-3 bg-slate-900 border border-purple-900/40 rounded-xl space-y-1">
          <span className="text-[11px] font-semibold text-purple-400 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>On Leave</span>
          </span>
          <div className="text-xl font-black text-purple-400 font-mono">{metrics.onLeave}</div>
          <span className="text-[10px] text-purple-500">Approved leave</span>
        </div>

        {/* Overtime Hours */}
        <div className="p-3 bg-slate-900 border border-blue-900/40 rounded-xl space-y-1">
          <span className="text-[11px] font-semibold text-blue-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>Total Overtime</span>
          </span>
          <div className="text-xl font-black text-blue-400 font-mono">
            {metrics.totalOvertimeHours} <span className="text-xs font-normal">hrs</span>
          </div>
          <span className="text-[10px] text-blue-400">Logged across outlets</span>
        </div>
      </div>

      {/* Staff Attendance Checklist */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-orange-400" />
            <h3 className="font-bold text-sm text-white">Daily Attendance Roster</h3>
            <span className="text-xs text-slate-400 font-mono">
              ({filteredStaff.length} Staff on Roster)
            </span>
          </div>
        </div>

        {filteredStaff.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Users className="w-8 h-8" />}
              title="No Staff Found"
              description="No staff members match the selected outlet or search filter. Add staff in Admin Master Data Hub."
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filteredStaff.map(staff => {
              const rec = attendanceMap.get(staff.id);
              if (!rec) return null;

              const staffLoc = locMap.get(rec.location_id) || locMap.get(staff.assigned_location_id || '');
              const roleInfo = roleBadges[staff.role] || { label: staff.role, color: 'bg-slate-800 text-slate-300' };

              return (
                <div
                  key={staff.id}
                  className={`p-3.5 sm:p-4 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                    rec.status === 'present'
                      ? 'bg-slate-900/60 hover:bg-slate-850'
                      : rec.status === 'half_day'
                      ? 'bg-amber-950/10 hover:bg-amber-950/20'
                      : rec.status === 'absent'
                      ? 'bg-rose-950/10 hover:bg-rose-950/20'
                      : 'bg-purple-950/10 hover:bg-purple-950/20'
                  }`}
                >
                  {/* Left Column: Staff Identity */}
                  <div className="flex items-center gap-3 min-w-[220px]">
                    <div className="w-10 h-10 rounded-xl bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
                      {staff.full_name
                        ? staff.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                        : 'ST'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{staff.full_name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium border ${roleInfo.color}`}>
                          {roleInfo.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-mono">{staff.phone}</span>
                        <span>•</span>
                        <span className="text-orange-400 font-medium">
                          {staffLoc ? `${staffLoc.name} (${staffLoc.code})` : 'All Outlets'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Column: Status Segmented Control */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Present */}
                    <button
                      type="button"
                      onClick={() => updateRecord(staff.id, { status: 'present' })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                        rec.status === 'present'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40 ring-1 ring-emerald-400'
                          : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Present</span>
                    </button>

                    {/* Half Day */}
                    <button
                      type="button"
                      onClick={() => updateRecord(staff.id, { status: 'half_day' })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                        rec.status === 'half_day'
                          ? 'bg-amber-600 text-white shadow-md shadow-amber-950/40 ring-1 ring-amber-400'
                          : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Half Day</span>
                    </button>

                    {/* Absent */}
                    <button
                      type="button"
                      onClick={() => updateRecord(staff.id, { status: 'absent', overtime_hours: 0 })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                        rec.status === 'absent'
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-950/40 ring-1 ring-rose-400'
                          : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>Absent</span>
                    </button>

                    {/* On Leave */}
                    <button
                      type="button"
                      onClick={() => updateRecord(staff.id, { status: 'on_leave', overtime_hours: 0 })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                        rec.status === 'on_leave'
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40 ring-1 ring-purple-400'
                          : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      <span>On Leave</span>
                    </button>
                  </div>

                  {/* Right Column: Overtime Stepper & Notes */}
                  <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap">
                    {/* Overtime Stepper */}
                    <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 font-semibold mr-1">Overtime:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const curr = rec.overtime_hours || 0;
                          updateRecord(staff.id, { overtime_hours: Math.max(0, curr - 0.5) });
                        }}
                        disabled={rec.status === 'absent' || rec.status === 'on_leave'}
                        className="w-6 h-6 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 flex items-center justify-center active:scale-95 disabled:opacity-30"
                        title="Reduce overtime by 30 mins"
                      >
                        <Minus className="w-3 h-3" />
                      </button>

                      <span className={`text-xs font-mono font-bold min-w-[36px] text-center ${
                        rec.overtime_hours > 0 ? 'text-blue-400' : 'text-slate-400'
                      }`}>
                        {rec.overtime_hours || 0}h
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          const curr = rec.overtime_hours || 0;
                          updateRecord(staff.id, { overtime_hours: curr + 0.5 });
                        }}
                        disabled={rec.status === 'absent' || rec.status === 'on_leave'}
                        className="w-6 h-6 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 flex items-center justify-center active:scale-95 disabled:opacity-30"
                        title="Add overtime by 30 mins"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Shift Remarks / Reason */}
                    <div className="flex-1 min-w-[150px]">
                      <input
                        type="text"
                        placeholder="Notes (e.g. Late by 1 hr, Rush cover)..."
                        value={rec.notes || ''}
                        onChange={e => updateRecord(staff.id, { notes: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
