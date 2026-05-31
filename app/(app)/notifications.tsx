import { Pressable, StyleSheet, Text, View } from "react-native";

import { Panel } from "../../src/components/Cards";
import { QueueList } from "../../src/components/Lists";
import { Screen } from "../../src/components/Screen";
import { useLiveNotifications } from "../../src/hooks/useLiveNotifications";
import { useSnapshot } from "../../src/hooks/useSnapshot";
import { isSupabaseEnabled } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";

export default function NotificationsScreen() {
  const { user } = useAuth();
  const snapshot = useSnapshot(user!.role);
  const { data, resolveNotification, resolving, isFetching } = useLiveNotifications();

  const items = isSupabaseEnabled
    ? (data ?? []).map((notification) => ({
        id: notification.id,
        title: notification.title,
        subtitle: `${notification.category} • ${notification.body}`,
        status: notification.urgent ? "Pending" : "Completed",
      }))
    : snapshot.notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        subtitle: `${notification.category} • ${notification.body}`,
        status: notification.urgent ? "Pending" : "Completed",
      }));

  return (
    <Screen title="Notifications" subtitle="Bell + inbox, with in-app, push, and email routing in v1.">
      <Panel title="Inbox" subtitle={isSupabaseEnabled ? (isFetching ? "Refreshing live inbox..." : "Live Supabase inbox records.") : "Scaffold mode until Supabase env vars are set."}>
        <QueueList items={items} />
        {isSupabaseEnabled && items.length > 0 ? (
          <View style={styles.actions}>
            <Pressable onPress={() => void resolveNotification(items[0]!.id)} style={styles.resolveButton}>
              <Text style={styles.resolveText}>{resolving ? "Resolving..." : "Resolve First Notification"}</Text>
            </Pressable>
          </View>
        ) : null}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    paddingTop: 4,
  },
  resolveButton: {
    alignSelf: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#173225",
    backgroundColor: "#0f1c16",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  resolveText: {
    color: "#f6fff9",
    fontWeight: "700",
  },
});
