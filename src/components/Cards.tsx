import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type PanelProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  onPress?: () => void;
  accent?: string;
};

export function Panel({ title, subtitle, children, onPress, accent = "#173225" }: PanelProps) {
  const body = (
    <View style={[styles.panel, { borderColor: accent }]}>
      {title ? <Text style={styles.panelTitle}>{title}</Text> : null}
      {subtitle ? <Text style={styles.panelSubtitle}>{subtitle}</Text> : null}
      <View style={styles.panelContent}>{children}</View>
    </View>
  );

  if (!onPress) {
    return body;
  }

  return <Pressable onPress={onPress}>{body}</Pressable>;
}

export function Badge({ label, tone = "#22c55e" }: { label: string; tone?: string }) {
  return (
    <View style={[styles.badge, { borderColor: tone, backgroundColor: `${tone}20` }]}>
      <Text style={[styles.badgeText, { color: tone }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#0c1b15",
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  panelTitle: {
    color: "#f6fff9",
    fontSize: 18,
    fontWeight: "700",
  },
  panelSubtitle: {
    color: "#86a896",
    fontSize: 13,
  },
  panelContent: {
    gap: 10,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
