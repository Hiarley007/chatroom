import type { TextStyle, ViewStyle } from 'react-native';

// ---------------------------------------------------------------------------
// Tokens de cor. As duas paletas têm exatamente os mesmos nomes: o app inteiro
// lê `colors.<token>` e nunca um valor fixo, então trocar de tema é trocar
// de paleta. Os pares texto/fundo respeitam contraste mínimo de 4,5:1 (WCAG AA),
// conferido em __tests__/theme.test.ts.
// ---------------------------------------------------------------------------
export const lightColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9', // campos, skeleton e áreas de apoio
  text: '#0F172A',
  muted: '#566579',
  border: '#E2E8F0',

  primary: '#2563EB', // preenchimentos (botões, balão próprio): texto branco por cima
  primarySoft: '#DBEAFE',
  onPrimarySoft: '#1D4ED8', // texto sobre primarySoft (botão secundário, selos)
  accent: '#2563EB', // texto e ícones de destaque sobre o fundo
  secondary: '#0EA5E9',
  onPrimary: '#FFFFFF',

  danger: '#DC2626', // preenchimento (botão perigoso)
  dangerText: '#B91C1C', // texto e ícones de erro sobre o fundo
  dangerSoft: '#FEE2E2',
  success: '#15803D',
  successSoft: '#DCFCE7',
  warning: '#B45309',
  warningSoft: '#FEF3C7',

  bubbleMine: '#2563EB',
  bubbleTheirs: '#EEF2F7',
  online: '#22C55E',
  overlay: 'rgba(15, 23, 42, 0.45)',
};

export type ThemeColors = Record<keyof typeof lightColors, string>;

export const darkColors: ThemeColors = {
  background: '#0B1220',
  surface: '#131C2E',
  surfaceAlt: '#1B2640',
  text: '#F1F5F9',
  muted: '#9AA9BD',
  border: '#26324A',

  primary: '#2563EB',
  primarySoft: '#172554',
  onPrimarySoft: '#9CC3FF',
  accent: '#7CB0FF',
  secondary: '#38BDF8',
  onPrimary: '#FFFFFF',

  danger: '#DC2626',
  dangerText: '#FCA5A5',
  dangerSoft: '#3F1D1D',
  success: '#4ADE80',
  successSoft: '#14352A',
  warning: '#FBBF24',
  warningSoft: '#3A2E10',

  bubbleMine: '#2563EB',
  bubbleTheirs: '#1F2A44',
  online: '#22C55E',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

// ---------------------------------------------------------------------------
// Espaçamento, raios e tamanhos
// ---------------------------------------------------------------------------
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 };

// Área de toque mínima recomendada (HIG da Apple e Material): 44 pt.
export const minTouchSize = 44;

// Largura máxima do conteúdo: em tablet e na web o app não se estica até as bordas.
export const maxContentWidth = 720;

// ---------------------------------------------------------------------------
// Tipografia (Inter). Cada peso é uma família própria: com fontes
// personalizadas, `fontWeight` não deve ser usado.
// ---------------------------------------------------------------------------
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

type TextToken = Pick<
  TextStyle,
  'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'
>;

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption'
  | 'small';

export const typography: Record<TextVariant, TextToken> = {
  display: { fontFamily: fontFamily.extrabold, fontSize: 32, lineHeight: 38 },
  title: { fontFamily: fontFamily.extrabold, fontSize: 28, lineHeight: 34 },
  heading: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 26 },
  subheading: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
  small: { fontFamily: fontFamily.medium, fontSize: 11, lineHeight: 14 },
};

// ---------------------------------------------------------------------------
// Sombras / elevação. No tema escuro a sombra some contra o fundo, então ela é
// mais forte lá e a borda (colors.border) faz o resto do trabalho.
// ---------------------------------------------------------------------------
export interface Shadows {
  card: ViewStyle;
  raised: ViewStyle;
}

const makeShadows = (isDark: boolean): Shadows => ({
  card: {
    shadowColor: '#000',
    shadowOpacity: isDark ? 0.35 : 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  raised: {
    shadowColor: '#000',
    shadowOpacity: isDark ? 0.5 : 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});

// ---------------------------------------------------------------------------
// O tema completo
// ---------------------------------------------------------------------------
export interface Theme {
  isDark: boolean;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  shadows: Shadows;
}

export const lightTheme: Theme = {
  isDark: false,
  colors: lightColors,
  spacing,
  radius,
  typography,
  shadows: makeShadows(false),
};

export const darkTheme: Theme = {
  isDark: true,
  colors: darkColors,
  spacing,
  radius,
  typography,
  shadows: makeShadows(true),
};
