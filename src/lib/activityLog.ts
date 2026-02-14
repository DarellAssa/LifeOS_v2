import { supabase } from '@/integrations/supabase/client';

export interface ActivityLogEntry {
  id: string;
  ts: string;
  source: 'user' | 'copilot' | 'automation' | 'system';
  action: string;
  entity_type: string;
  entity_id?: string;
  title?: string;
  metadata?: Record<string, any>;
}

export async function dbInsertActivityLog(
  userId: string,
  entry: Omit<ActivityLogEntry, 'id' | 'ts'>
) {
  const { error } = await supabase.from('activity_log' as any).insert({
    user_id: userId,
    source: entry.source,
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id || null,
    title: entry.title || null,
    metadata: entry.metadata || {},
  });
  if (error) console.error('Activity log insert failed:', error.message);
}

export async function fetchActivityLog(
  userId: string,
  opts: { source?: string; days?: number; limit?: number } = {}
): Promise<ActivityLogEntry[]> {
  const { source, days = 7, limit = 100 } = opts;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  let query = (supabase.from('activity_log' as any) as any)
    .select('*')
    .eq('user_id', userId)
    .gte('ts', since)
    .order('ts', { ascending: false })
    .limit(limit);

  if (source && source !== 'all') {
    query = query.eq('source', source);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Activity log fetch failed:', error.message);
    return [];
  }
  return (data || []) as ActivityLogEntry[];
}

export function getEntityRoute(entityType: string, entityId?: string): string | null {
  if (!entityId) return null;
  switch (entityType) {
    case 'task': return `/tasks`;
    case 'goal': return `/goals`;
    case 'event':
    case 'focus_block': return `/calendar`;
    case 'inbox': return `/inbox`;
    case 'note': return `/inbox`;
    case 'habit': return `/habits`;
    case 'template': return `/templates`;
    case 'automation': return `/automations`;
    default: return null;
  }
}

export function formatAction(action: string, entityType: string): string {
  const typeLabel = entityType.replace('_', ' ');
  switch (action) {
    case 'created': return `Created ${typeLabel}`;
    case 'updated': return `Updated ${typeLabel}`;
    case 'archived': return `Archived ${typeLabel}`;
    case 'restored': return `Restored ${typeLabel}`;
    case 'completed': return `Completed ${typeLabel}`;
    case 'deleted': return `Deleted ${typeLabel}`;
    case 'converted': return `Converted ${typeLabel}`;
    default: return `${action} ${typeLabel}`;
  }
}
