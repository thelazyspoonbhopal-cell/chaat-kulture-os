import { db } from '../db';
import type { StaffAttendanceRecord, AttendanceStatus, UserProfile } from '../../types';
import { fetchGistFile, updateGistFiles } from '../sync/cloudRegistry';

export const ATTENDANCE_GIST_FILE = 'chaat_kulture_attendance.json';

export interface CloudAttendancePayload {
  attendance: StaffAttendanceRecord[];
  updated_at: string;
}

let isAttendanceSyncing = false;
let attendanceSyncTimeout: any = null;
let lastAttendanceSyncTimestamp = 0;

export const attendanceRepo = {
  // ---------------- CLOUD REGISTRY SYNC ----------------
  async fetchCloudAttendance(): Promise<CloudAttendancePayload | null> {
    try {
      const data = await fetchGistFile<CloudAttendancePayload>(ATTENDANCE_GIST_FILE);
      if (data && Array.isArray(data.attendance)) {
        return data;
      }
    } catch (err) {
      console.warn('[AttendanceRepo] Failed to fetch cloud attendance:', err);
    }
    return null;
  },

  async syncAttendanceToCloud(): Promise<boolean> {
    try {
      // 1. Fetch current cloud attendance to avoid clobbering records logged across other browsers
      const [cloudData, localRecords] = await Promise.all([
        this.fetchCloudAttendance(),
        db.staff_attendance.toArray(),
      ]);

      const attMap = new Map<string, StaffAttendanceRecord>();

      // First add cloud records
      if (cloudData && Array.isArray(cloudData.attendance)) {
        cloudData.attendance.forEach(a => attMap.set(a.id, a));
      }
      // Merge local records (local state takes precedence)
      localRecords.forEach(a => attMap.set(a.id, a));

      const mergedAttendance = Array.from(attMap.values())
        .filter(a => a.role !== 'owner' && a.user_id !== 'usr_owner');

      // Save any missing cloud records into local Dexie store (excluding admin)
      if (cloudData && Array.isArray(cloudData.attendance)) {
        for (const a of cloudData.attendance) {
          if (a.role === 'owner' || a.user_id === 'usr_owner') continue;
          if (!localRecords.some(lr => lr.id === a.id)) {
            await db.staff_attendance.put(a);
          }
        }
      }

      const payload: CloudAttendancePayload = {
        attendance: mergedAttendance,
        updated_at: new Date().toISOString(),
      };

      const success = await updateGistFiles({
        [ATTENDANCE_GIST_FILE]: payload,
      });

      if (success) {
        lastAttendanceSyncTimestamp = Date.now();
      }
      return success;
    } catch (err) {
      console.error('[AttendanceRepo] Failed to sync attendance to cloud:', err);
      return false;
    }
  },

  debouncedSyncToCloud() {
    if (attendanceSyncTimeout) clearTimeout(attendanceSyncTimeout);
    attendanceSyncTimeout = setTimeout(() => {
      this.syncAttendanceToCloud().catch(e => console.warn('[AttendanceRepo] Background sync failed:', e));
    }, 2000);
  },

  async syncFromCloud(force = false): Promise<void> {
    if (isAttendanceSyncing && !force) return;
    isAttendanceSyncing = true;
    try {
      const [cloudData, localRecords] = await Promise.all([
        this.fetchCloudAttendance(),
        db.staff_attendance.toArray(),
      ]);

      if (cloudData && Array.isArray(cloudData.attendance) && cloudData.attendance.length > 0) {
        for (const a of cloudData.attendance) {
          await db.staff_attendance.put(a);
        }

        // If local has records not yet in cloud, push union back
        const cloudIds = new Set(cloudData.attendance.map(a => a.id));
        const hasExtra = localRecords.some(a => !cloudIds.has(a.id));
        if (hasExtra) {
          await this.syncAttendanceToCloud();
        }
      } else if (localRecords.length > 0) {
        await this.syncAttendanceToCloud();
      }

      lastAttendanceSyncTimestamp = Date.now();
    } catch (err) {
      console.error('[AttendanceRepo] Sync from cloud failed:', err);
    } finally {
      isAttendanceSyncing = false;
    }
  },

  // ---------------- ATTENDANCE QUERIES ----------------
  async getAttendanceForDate(date: string, locationId?: string, forceSync = false): Promise<StaffAttendanceRecord[]> {
    let list = await db.staff_attendance.toArray();
    if (forceSync || list.length === 0 || Date.now() - lastAttendanceSyncTimestamp > 15000) {
      await this.syncFromCloud().catch(() => {});
      list = await db.staff_attendance.toArray();
    }

    list = list.filter(a => a.date === date && a.role !== 'owner' && a.user_id !== 'usr_owner');

    if (locationId && locationId !== 'all') {
      list = list.filter(a => a.location_id === locationId);
    }

    return list;
  },

  async saveAttendanceRecords(records: StaffAttendanceRecord[], updatedBy: string): Promise<void> {
    const now = new Date().toISOString();
    const cleanRecords = records.filter(r => r.role !== 'owner' && r.user_id !== 'usr_owner');
    if (cleanRecords.length === 0) return;

    await db.transaction('rw', [db.staff_attendance, db.audit_logs], async () => {
      for (const rec of cleanRecords) {
        const toSave: StaffAttendanceRecord = {
          ...rec,
          recorded_by: updatedBy,
          updated_at: now,
        };
        await db.staff_attendance.put(toSave);
      }

      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: 'biz_chaatkulture_01',
        action: 'UPDATE_STAFF_ATTENDANCE',
        entity: 'staff_attendance',
        entity_id: cleanRecords[0]?.date || now.split('T')[0],
        location_id: cleanRecords[0]?.location_id || 'loc_base_01',
        new_data: {
          count: cleanRecords.length,
          date: cleanRecords[0]?.date,
          updatedBy,
        },
        created_at: now,
      });
    });

    // Immediate sync across browsers
    this.syncAttendanceToCloud().catch(e => console.warn('[AttendanceRepo] Cloud push failed:', e));
  },

  async saveSingleRecord(record: StaffAttendanceRecord, updatedBy: string): Promise<void> {
    if (record.role === 'owner' || record.user_id === 'usr_owner') return;
    const now = new Date().toISOString();
    const toSave: StaffAttendanceRecord = {
      ...record,
      recorded_by: updatedBy,
      updated_at: now,
    };
    await db.staff_attendance.put(toSave);
    this.debouncedSyncToCloud();
  },

  /**
   * Quick 1-click helper to mark all staff as present for a selected date
   */
  async markAllPresent(
    date: string,
    targetLocationId: string,
    staffList: UserProfile[],
    recordedBy: string
  ): Promise<StaffAttendanceRecord[]> {
    const now = new Date().toISOString();
    const nonAdminStaff = staffList.filter(u => u.role !== 'owner' && u.id !== 'usr_owner');
    const records: StaffAttendanceRecord[] = nonAdminStaff.map(u => {
      const locId = targetLocationId === 'all'
        ? (u.assigned_location_id || u.assigned_location_ids?.[0] || 'loc_base_01')
        : targetLocationId;

      return {
        id: `att_${date.replace(/-/g, '')}_${u.id}`,
        user_id: u.id,
        user_name: u.full_name,
        role: u.role,
        location_id: locId,
        date,
        status: 'present' as AttendanceStatus,
        overtime_hours: 0,
        check_in_time: '10:00',
        check_out_time: '22:00',
        recorded_by: recordedBy,
        updated_at: now,
      };
    });

    await this.saveAttendanceRecords(records, recordedBy);
    return records;
  },

  async getSummaryForDate(date: string, locationId?: string) {
    const records = await this.getAttendanceForDate(date, locationId);
    let present = 0;
    let halfDay = 0;
    let absent = 0;
    let onLeave = 0;
    let totalOvertimeHours = 0;

    for (const r of records) {
      if (r.status === 'present') present++;
      else if (r.status === 'half_day') halfDay++;
      else if (r.status === 'absent') absent++;
      else if (r.status === 'on_leave') onLeave++;

      totalOvertimeHours += r.overtime_hours || 0;
    }

    return {
      total: records.length,
      present,
      halfDay,
      absent,
      onLeave,
      totalOvertimeHours,
    };
  },
};
