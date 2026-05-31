import { PropsWithChildren, ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  right?: ReactNode;
  scroll?: boolean;
}>;

export function Screen({ title, subtitle, right, children, scroll = true }: ScreenProps) {
  const content = (
    <View style={styles.inner}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#06110d",
  },
  scroll: {
    paddingBottom: 32,
  },
  inner: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  title: {
    color: "#f6fff9",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#9dc9b0",
    fontSize: 14,
    lineHeight: 20,
  },
  right: {
    alignSelf: "center",
  },
});
