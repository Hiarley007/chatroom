import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { darkTheme, lightTheme } from '@/theme';
import type { Theme } from '@/theme';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'chatroom:theme-mode';

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  mode: 'system',
  setMode: () => {},
});

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === 'system' || value === 'light' || value === 'dark';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Recupera a escolha salva no aparelho.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (isThemeMode(saved)) setModeState(saved);
      })
      .catch(() => {});
  }, []);

  // Faz os componentes nativos (Alert, teclado) acompanharem a escolha.
  // Na web esse recurso não existe, por isso o try/catch.
  useEffect(() => {
    try {
      Appearance.setColorScheme?.(mode === 'system' ? 'auto' : mode);
    } catch {
      // sem suporte nesta plataforma: o tema do app continua funcionando
    }
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const isDark = mode === 'system' ? scheme === 'dark' : mode === 'dark';

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: isDark ? darkTheme : lightTheme, mode, setMode }),
    [isDark, mode, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// O tema ativo (cores, espaçamentos, tipografia, sombras).
export const useTheme = (): Theme => useContext(ThemeContext).theme;

// A preferência da pessoa: seguir o sistema, forçar claro ou forçar escuro.
export function useThemeMode() {
  const { mode, setMode } = useContext(ThemeContext);
  return { mode, setMode };
}
