import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  timezone: string;
  week_start: string;
  onboarding_completed: boolean;
  focus_areas: string[];
  operating_style: string;
  modules: Record<string, boolean>;
  preferences: Record<string, any>;
  demo_mode: boolean;
}

const DEFAULT_MODULES: Record<string, boolean> = {
  tasks: true,
  goals: true,
  calendar: true,
  focus: true,
  habits: true,
  checkin: true,
  lifeScore: true,
  inbox: true,
  notes: true,
  analytics: true,
  planning: true,
  notifications: true,
  templates: false,
  automations: false,
  copilot: true,
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  isModuleEnabled: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (data && !error) {
      setProfile({
        id: data.id,
        email: data.email || '',
        first_name: data.first_name,
        timezone: data.timezone || 'UTC',
        week_start: data.week_start || 'mon',
        onboarding_completed: data.onboarding_completed || false,
        focus_areas: (data.focus_areas as string[]) || [],
        operating_style: (data.operating_style as string) || 'flexible',
        modules: (data.modules as Record<string, boolean>) || DEFAULT_MODULES,
        preferences: (data.preferences as Record<string, any>) || {},
        demo_mode: data.demo_mode || false,
      });
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => fetchProfile(sess.user.id), 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        fetchProfile(sess.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error?.message || null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  };

  const signOut = async () => {
    // Clear local app data
    localStorage.removeItem('lifeos-data');
    localStorage.removeItem('lifeos-copilot-history');
    setProfile(null);
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    return { error: error?.message || null };
  };

  const updateProfileFn = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const dbUpdates: Record<string, any> = {};
    if (updates.first_name !== undefined) dbUpdates.first_name = updates.first_name;
    if (updates.timezone !== undefined) dbUpdates.timezone = updates.timezone;
    if (updates.week_start !== undefined) dbUpdates.week_start = updates.week_start;
    if (updates.onboarding_completed !== undefined) dbUpdates.onboarding_completed = updates.onboarding_completed;
    if (updates.focus_areas !== undefined) dbUpdates.focus_areas = updates.focus_areas;
    if (updates.operating_style !== undefined) dbUpdates.operating_style = updates.operating_style;
    if (updates.modules !== undefined) dbUpdates.modules = updates.modules;
    if (updates.preferences !== undefined) dbUpdates.preferences = updates.preferences;
    if (updates.demo_mode !== undefined) dbUpdates.demo_mode = updates.demo_mode;

    await supabase.from('profiles').update(dbUpdates).eq('id', user.id);
    setProfile(prev => prev ? { ...prev, ...updates } : null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const isModuleEnabled = (module: string): boolean => {
    if (!profile) return true;
    const modules = profile.modules || DEFAULT_MODULES;
    return modules[module] !== false;
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading,
      signUp, signIn, signOut, resetPassword,
      updateProfile: updateProfileFn, refreshProfile, isModuleEnabled,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { DEFAULT_MODULES };
