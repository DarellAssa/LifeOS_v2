import { useState, useEffect } from 'react';

// Force light on every fresh module load — clear any stale dark preference
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('lifeos-theme');
  if (stored === 'dark') {
    // User explicitly chose dark previously — respect it
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('lifeos-theme', 'light');
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('lifeos-theme');
      if (stored === 'dark') return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('lifeos-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return { theme, setTheme, toggleTheme };
}
