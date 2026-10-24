import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Image, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { artSource, CONFETTI_BURST } from './art';
import { useTheme } from '../theme/useTheme';
import { motion, shadowOffset, space, stroke, type CelebrateName } from '../theme/tokens';

const PRESS = { damping: 18, stiffness: 420, mass: 0.35 };
const SETTLE = { damping: 16, stiffness: 220, mass: 0.6 };
const POP = { damping: 10, stiffness: 160, mass: 0.55 };

const playedEntrances = new Set<string>();

const PIECES = [
  { x: -110, y: -140, spin: -18 },
  { x: 120, y: -120, spin: 22 },
  { x: -130, y: 30, spin: 10 },
  { x: 100, y: 70, spin: -24 },
  { x: -20, y: -180, spin: 14 },
  { x: 30, y: 110, spin: -12 },
  { x: 70, y: -40, spin: 16 },
];

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let subscription: { remove: () => void } | undefined;
    const current = AccessibilityInfo.isReduceMotionEnabled?.();
    if (current && typeof current.then === 'function') {
      current.then(setReduce).catch(() => undefined);
    }
    if (typeof AccessibilityInfo.addEventListener === 'function') {
      subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    }
    return () => subscription?.remove();
  }, []);
  return reduce;
}

export function useStickerMotion(pressed: boolean, shadow: boolean) {
  const reduce = useReduceMotion();
  const shift = useSharedValue(0);
  const scale = useSharedValue(1);
  useEffect(() => {
    const nextShift = pressed && shadow ? shadowOffset : 0;
    const nextScale = pressed && !shadow ? 0.97 : 1;
    if (reduce) {
      shift.value = nextShift;
      scale.value = nextScale;
      return;
    }
    shift.value = withSpring(nextShift, PRESS);
    scale.value = withSpring(nextScale, PRESS);
  }, [pressed, reduce, scale, shadow, shift]);
  const face = useAnimatedStyle(() => ({
    transform: [
      { translateX: shift.value },
      { translateY: shift.value },
      { scale: scale.value },
    ],
  }));
  const shade = useAnimatedStyle(() => ({
    opacity: shift.value > shadowOffset * 0.6 ? 0 : 1,
  }));
  return { face, shade };
}

export function Settle({ children, distance = 16, delay = 0 }: { children: React.ReactNode; distance?: number; delay?: number }) {
  const reduce = useReduceMotion();
  const progress = useSharedValue(reduce || delay === 0 ? (reduce ? 1 : 0) : 0);
  useEffect(() => {
    const spring = withSpring(1, SETTLE);
    progress.value = reduce ? 1 : delay > 0 ? withDelay(delay, spring) : spring;
  }, [delay, progress, reduce]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }), [distance]);
  if (reduce) {
    return <View>{children}</View>;
  }
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function Bob({ children }: { children: React.ReactNode }) {
  const reduce = useReduceMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduce) {
      y.value = 0;
      return;
    }
    y.value = withRepeat(withSequence(
      withTiming(-6, { duration: 480 }),
      withTiming(0, { duration: 480 }),
    ), -1, false);
    return () => cancelAnimation(y);
  }, [reduce, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  if (reduce) {
    return <View>{children}</View>;
  }
  return <Animated.View style={style}>{children}</Animated.View>;
}

const SHIMMER_BAR = 18;
const SHIMMER_BARS = 3;

/** Height of the three loading bars, so the slot can stay put before they appear. */
export const shimmerSlotHeight = SHIMMER_BARS * SHIMMER_BAR + (SHIMMER_BARS - 1) * space.xs;

export function ShimmerSlot({ label, busy }: { label: string; busy: boolean }) {
  return (
    <View style={{ minHeight: shimmerSlotHeight }} accessibilityElementsHidden={!busy}>
      {busy ? <Shimmer label={label} /> : null}
    </View>
  );
}

export function Shimmer({ label }: { label: string }) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const pulse = useSharedValue(reduce ? 0.7 : 0.45);
  useEffect(() => {
    if (reduce) {
      pulse.value = 0.7;
      return;
    }
    pulse.value = withRepeat(withSequence(
      withTiming(1, { duration: 700 }),
      withTiming(0.45, { duration: 700 }),
    ), -1, false);
    return () => cancelAnimation(pulse);
  }, [pulse, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const bars = [styles.barWide, styles.barMid, styles.barShort];
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }} style={styles.shimmer}>
      {bars.map((width, index) => (
        <Animated.View
          key={index}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.bar, width, { backgroundColor: colors.surfaceAlt, borderColor: colors.outline }, reduce ? styles.steady : style]}
        />
      ))}
    </View>
  );
}

export function CelebrateArt({
  name,
  kind,
  size = 72,
}: {
  name: CelebrateName;
  kind: 'claim' | 'wrap' | 'still';
  size?: number;
}) {
  const reduce = useReduceMotion();
  const progress = useSharedValue(kind === 'still' ? 1 : 0);
  useEffect(() => {
    if (kind === 'still') {
      progress.value = 1;
      return;
    }
    if (reduce) {
      progress.value = withTiming(1, { duration: 280 });
      return;
    }
    progress.value = kind === 'wrap'
      ? withTiming(1, { duration: motion.duration.celebrate })
      : withSpring(1, SETTLE);
  }, [kind, progress, reduce]);
  const style = useAnimatedStyle(() => {
    if (reduce || kind === 'still') {
      return { opacity: kind === 'still' ? 1 : progress.value, transform: [{ scale: 1 }] };
    }
    if (kind === 'wrap') {
      const closing = progress.value < 0.45;
      const scaleX = closing
        ? 1 - (progress.value / 0.45) * 0.85
        : 0.15 + ((progress.value - 0.45) / 0.55) * 0.85;
      return { opacity: 1, transform: [{ scaleX }, { scaleY: 0.92 + scaleX * 0.08 }] };
    }
    return {
      opacity: progress.value,
      transform: [
        { scale: 0.6 + progress.value * 0.4 },
        { rotate: `${-8 * (1 - progress.value)}deg` },
      ],
    };
  });
  return (
    <Animated.View style={style} pointerEvents="none">
      <Image
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        accessibilityIgnoresInvertColors
        source={artSource(name)}
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
    </Animated.View>
  );
}

export function Moment({
  kind,
  name,
  onDone,
}: {
  kind: 'claim' | 'wrap';
  name: CelebrateName;
  onDone?: () => void;
}) {
  const reduce = useReduceMotion();
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const timer = setTimeout(() => done.current?.(), reduce ? 280 : motion.duration.celebrate);
    return () => clearTimeout(timer);
  }, [reduce]);
  return (
    <View pointerEvents="none" style={styles.moment}>
      <CelebrateArt name={name} kind={kind} size={96} />
    </View>
  );
}

export function HeartPop({ saved, children }: { saved: boolean; children: React.ReactNode }) {
  const reduce = useReduceMotion();
  const scale = useSharedValue(1);
  const was = useRef(saved);
  useEffect(() => {
    if (saved && !was.current && !reduce) {
      scale.value = withSequence(withSpring(1.3, POP), withDelay(90, withSpring(1, POP)));
    } else if (reduce) {
      scale.value = 1;
    }
    was.current = saved;
  }, [reduce, saved, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  if (reduce) {
    return <View>{children}</View>;
  }
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Card entrance for a tab. Later visits in this session appear at once. */
export function SessionEntrance({ id, children }: { id: string; children: React.ReactNode }) {
  const reduce = useReduceMotion();
  const [play] = useState(() => !reduce && !playedEntrances.has(id));
  useEffect(() => {
    playedEntrances.add(id);
  }, [id]);
  const items = React.Children.toArray(children);
  if (!play) {
    return <View style={styles.stack}>{children}</View>;
  }
  return (
    <View style={styles.stack}>
      {items.map((child, index) => (
        <Settle key={index} delay={Math.min(index, 5) * 50} distance={14}>
          {child}
        </Settle>
      ))}
    </View>
  );
}

export function Unwrap({ children }: { children: React.ReactNode }) {
  const reduce = useReduceMotion();
  const progress = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    progress.value = reduce ? 1 : withSpring(1, SETTLE);
  }, [progress, reduce]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.4 + progress.value * 0.6,
    transform: [
      { scale: 0.55 + progress.value * 0.45 },
      { rotate: `${-16 + progress.value * 16}deg` },
    ],
  }));
  if (reduce) {
    return <View style={styles.center}>{children}</View>;
  }
  return <Animated.View style={[styles.center, style]}>{children}</Animated.View>;
}

function ConfettiPiece({
  piece,
  progress,
}: {
  piece: { x: number; y: number; spin: number };
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: piece.x * progress.value },
      { translateY: piece.y * progress.value },
      { rotate: `${piece.spin * progress.value}deg` },
    ],
  }));
  return <Animated.Image source={CONFETTI_BURST} resizeMode="contain" style={[styles.piece, style]} />;
}

export function ConfettiBurst() {
  const reduce = useReduceMotion();
  const progress = useSharedValue(0);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const ms = reduce ? 320 : motion.duration.celebrate;
    progress.value = reduce
      ? withSequence(withTiming(1, { duration: 140 }), withTiming(0, { duration: 180 }))
      : withTiming(1, { duration: ms });
    const timer = setTimeout(() => setGone(true), ms);
    return () => clearTimeout(timer);
  }, [progress, reduce]);
  const fade = useAnimatedStyle(() => ({ opacity: progress.value }));
  if (gone) {
    return null;
  }
  if (reduce) {
    return (
      <Animated.View pointerEvents="none" accessibilityElementsHidden style={[styles.fill, fade]}>
        <Image source={CONFETTI_BURST} resizeMode="contain" style={styles.piece} />
      </Animated.View>
    );
  }
  return (
    <View pointerEvents="none" accessibilityElementsHidden style={styles.fill}>
      {PIECES.map(piece => (
        <ConfettiPiece key={`${piece.x}:${piece.y}`} piece={piece} progress={progress} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  piece: { position: 'absolute', width: 88, height: 88 },
  moment: { position: 'absolute', top: 0, right: 0 },
  center: { alignSelf: 'center' },
  stack: { gap: space.sm },
  shimmer: { gap: space.xs },
  bar: { height: 18, borderRadius: 12, borderWidth: stroke.inner },
  steady: { opacity: 0.7 },
  barWide: { width: '100%' },
  barMid: { width: '86%' },
  barShort: { width: '64%' },
});
