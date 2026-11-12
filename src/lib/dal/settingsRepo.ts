import { db } from '../db';
import type { Business, FeatureFlag } from '../../types';

export const settingsRepo = {
  async getBusiness(): Promise<Business | undefined> {
    return await db.businesses.get('biz_chaatkulture_01');
  },

  async updateBusiness(updates: Partial<Business>): Promise<void> {
    await db.businesses.update('biz_chaatkulture_01', {
      ...updates,
      updated_at: new Date().toISOString(),
    });
  },

  async getFeatureFlags(): Promise<FeatureFlag[]> {
    return await db.feature_flags.toArray();
  },

  async toggleFeatureFlag(id: string, is_enabled: boolean): Promise<void> {
    await db.feature_flags.update(id, { is_enabled });

    const flag = await db.feature_flags.get(id);
    await db.audit_logs.put({
      id: 'audit_' + Date.now(),
      business_id: 'biz_chaatkulture_01',
      action: 'TOGGLE_FEATURE_FLAG',
      entity: 'feature_flags',
      entity_id: id,
      new_data: { feature_key: flag?.feature_key, is_enabled },
      created_at: new Date().toISOString(),
    });
  },
};
