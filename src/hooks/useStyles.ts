import { useMemo } from 'react';
import { useTheme } from '@/context/ThemeContext';
import type { Theme } from '@/theme';

// Estilos que dependem do tema. A função `factory` fica FORA do componente
// (no nível do módulo), então o resultado só é recalculado quando o tema muda:
//
//   const createStyles = ({ colors }: Theme) =>
//     StyleSheet.create({ box: { backgroundColor: colors.surface } });
//
//   const styles = useStyles(createStyles);
export function useStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
