import React from 'react';
import { Pressable, Text, View, StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Path, Line, Circle, Text as T } from 'react-native-svg';
import { useTheme, vColor, vBg, SVG_FONT, type Theme } from './theme';

export function Chip({ v, small }: { v: string; small?: boolean }) {
  const t = useTheme();
  return <Text style={[s.chip, { backgroundColor: vBg(t, v), color: vColor(t, v), fontSize: small ? 10 : 12 }]}>{v}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.paper, borderColor: t.line, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 16, gap: 10 }, style]}>{children}</View>;
}

export function Label({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>{children}</Text>;
}

export function Segmented<K extends string>({ value, options, onChange }: { value: K; options: { key: K; label: string }[]; onChange: (k: K) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: t.ink, borderRadius: 6, overflow: 'hidden' }}>
      {options.map((o, i) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(o.key)}
            style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, backgroundColor: on ? t.ink : t.paper, borderLeftWidth: i ? 1 : 0, borderLeftColor: t.ink }}>
            <Text style={{ textAlign: 'center', fontWeight: '700', color: on ? t.paper : t.ink, fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Medidor semicircular 0–100. */
export function Gauge({ score, t }: { score: number; t: Theme }) {
  const a = (-90 + 180 * score / 100) * Math.PI / 180;
  const x2 = 80 + 54 * Math.sin(a), y2 = 88 - 54 * Math.cos(a);
  return (
    <Svg width={120} height={90} viewBox="0 0 160 120">
      <Path d="M14 88 A66 66 0 0 1 47 31" stroke={t.bad} strokeWidth={14} fill="none" />
      <Path d="M49 30 A66 66 0 0 1 111 30" stroke={t.ok} strokeWidth={14} fill="none" />
      <Path d="M113 31 A66 66 0 0 1 146 88" stroke={t.good} strokeWidth={14} fill="none" />
      <Line x1={80} y1={88} x2={x2} y2={y2} stroke={t.ink} strokeWidth={4} strokeLinecap="round" />
      <Circle cx={80} cy={88} r={7} fill={t.ink} />
      <T x={80} y={116} fontSize={20} fill={t.ink} textAnchor="middle" fontWeight="700" fontFamily={SVG_FONT}>{score}</T>
    </Svg>
  );
}

const s = StyleSheet.create({
  chip: { fontWeight: '800', letterSpacing: 0.5, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
});
