import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Quem ativa "Reduzir movimento" no sistema não quer animações: os componentes
// animados consultam este hook e ficam estáticos.
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduce(enabled);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduce,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduce;
}
