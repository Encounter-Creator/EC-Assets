import { ReactNode } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

type ScreenProps = {
  title: string;
  kicker?: string;
  subtitle?: string;
  children: ReactNode;
  scroll?: boolean;
};

export function Screen({ title, kicker, subtitle, children, scroll = true }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={scroll}
      >
        <View style={styles.header}>
          {kicker ? <Text style={styles.kicker}>{kicker.toUpperCase()}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.body}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionTitleText}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  tone = "primary",
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        tone === "secondary" && styles.buttonSecondary,
        tone === "danger" && styles.buttonDanger,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      <Text style={[styles.buttonLabel, tone === "danger" && styles.buttonLabelDanger]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#69817a"
        secureTextEntry={secureTextEntry}
        style={styles.input}
        autoCapitalize="none"
      />
    </View>
  );
}

export function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function ListRow({
  title,
  description,
  meta,
}: {
  title: string;
  description?: string;
  meta?: string;
}) {
  return (
    <View style={styles.listRow}>
      <View style={styles.listRowText}>
        <Text style={styles.listRowTitle}>{title}</Text>
        {description ? <Text style={styles.listRowDescription}>{description}</Text> : null}
      </View>
      {meta ? <Text style={styles.listRowMeta}>{meta}</Text> : null}
    </View>
  );
}

export function LoadingState({ label = "Loading data" }: { label?: string }) {
  return (
    <View style={styles.loadingState}>
      <ActivityIndicator color="#67e8a0" />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#06110b",
  },
  container: {
    flex: 1,
    backgroundColor: "#06110b",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 16,
  },
  body: {
    gap: 16,
    paddingBottom: 16,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
    gap: 8,
  },
  kicker: {
    color: "#7ca68f",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  title: {
    color: "#f6fff9",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  subtitle: {
    color: "#a8c0b4",
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#0d1c15",
    borderColor: "#173227",
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    gap: 4,
  },
  sectionTitleText: {
    color: "#f2fbf5",
    fontSize: 18,
    fontWeight: "700",
  },
  sectionSubtitle: {
    color: "#8fa89b",
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    backgroundColor: "#16442f",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSecondary: {
    backgroundColor: "#12251d",
    borderWidth: 1,
    borderColor: "#214032",
  },
  buttonDanger: {
    backgroundColor: "#4a1f1f",
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonLabel: {
    color: "#f5fff8",
    fontWeight: "700",
    fontSize: 14,
  },
  buttonLabelDanger: {
    color: "#ffe6e6",
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: "#93ac9e",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#08150f",
    borderWidth: 1,
    borderColor: "#20382c",
    borderRadius: 16,
    color: "#f6fff9",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: "#13291f",
    borderColor: "#224233",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: {
    color: "#b8d4c1",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  statCard: {
    flex: 1,
    minWidth: "46%",
    backgroundColor: "#0b1812",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#193126",
    padding: 14,
    gap: 10,
  },
  statLabel: {
    color: "#88a395",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  statValue: {
    color: "#f7fffa",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  listRow: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#193126",
    backgroundColor: "#09150f",
    padding: 14,
    gap: 8,
  },
  listRowText: {
    gap: 4,
  },
  listRowTitle: {
    color: "#f6fff9",
    fontSize: 15,
    fontWeight: "700",
  },
  listRowDescription: {
    color: "#96ad9d",
    fontSize: 13,
    lineHeight: 18,
  },
  listRowMeta: {
    color: "#6f8b7e",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  loadingState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  loadingText: {
    color: "#a9c0b4",
    fontSize: 14,
  },
});
