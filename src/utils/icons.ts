import { Ionicons } from '@expo/vector-icons';

/**
 * Nome de qualquer ícone aceito pelo conjunto Ionicons do Expo.
 * Derivar o tipo do próprio conjunto mantém `IconName` alinhado
 * com o valor permitido na propriedade `name` de `<Ionicons />`.
 */
export type IconName = keyof typeof Ionicons.glyphMap;
