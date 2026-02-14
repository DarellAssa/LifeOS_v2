// ── User Preferences Schema ──

export interface SchedulePreferences {
  work_hours: { start: string; end: string };
  work_days: string[]; // ["MO","TU","WE","TH","FR"]
  default_focus_minutes: number;
  preferred_window: 'morning' | 'afternoon' | 'balanced';
  avoid_evenings: boolean;
}

export interface TriagePreferences {
  default_batch_size: number;
  default_confidence: 'high_only' | 'high_med';
  archive_after_convert: boolean;
}

export interface CopilotPreferences {
  default_mode: 'chat' | 'plan_do';
  confirm_level: 'standard' | 'strict';
  show_tool_details: boolean;
}

export interface BriefingPreferences {
  auto_generate_daily: boolean;
  show_on_dashboard: boolean;
  nba_count: number;
}

export interface UserPreferences {
  schedule: SchedulePreferences;
  triage: TriagePreferences;
  copilot: CopilotPreferences;
  briefing: BriefingPreferences;
  _dismissed?: Record<string, boolean>; // dismissed nudges
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  schedule: {
    work_hours: { start: '09:00', end: '18:00' },
    work_days: ['MO', 'TU', 'WE', 'TH', 'FR'],
    default_focus_minutes: 90,
    preferred_window: 'balanced',
    avoid_evenings: true,
  },
  triage: {
    default_batch_size: 20,
    default_confidence: 'high_only',
    archive_after_convert: true,
  },
  copilot: {
    default_mode: 'plan_do',
    confirm_level: 'standard',
    show_tool_details: false,
  },
  briefing: {
    auto_generate_daily: true,
    show_on_dashboard: true,
    nba_count: 4,
  },
};

/** Deep merge defaults into existing prefs (preserves user values) */
export function mergePreferences(existing: Record<string, any> | null | undefined): UserPreferences {
  const defaults = DEFAULT_PREFERENCES;
  if (!existing || typeof existing !== 'object') return { ...defaults };
  
  return {
    schedule: {
      ...defaults.schedule,
      ...(existing.schedule || {}),
      work_hours: {
        ...defaults.schedule.work_hours,
        ...(existing.schedule?.work_hours || {}),
      },
    },
    triage: { ...defaults.triage, ...(existing.triage || {}) },
    copilot: { ...defaults.copilot, ...(existing.copilot || {}) },
    briefing: { ...defaults.briefing, ...(existing.briefing || {}) },
    _dismissed: existing._dismissed || {},
  };
}
