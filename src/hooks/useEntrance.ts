import { useEffect, useState } from 'react';
import { Animated, Platform } from 'react-native';
import { useReduceMotion } from './useReduceMotion';

// Entrada suave (aparece e sobe 8 px). Devolve o estilo animado para um
// <Animated.View>. Com `enabled = false` ou "Reduzir movimento" ligado, o item
// já nasce no lugar final, sem animação.
export function useEntrance(enabled: boolean) {
  const reduceMotion = useReduceMotion();
  const animate = enabled && !reduceMotion;
  const [progress] = useState(() => new Animated.Value(animate ? 0 : 1));

  useEffect(() => {
    if (!animate) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [animate, progress]);

  return {
    opacity: progress,
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
    ],
  };
}
