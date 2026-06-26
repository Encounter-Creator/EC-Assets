import AsyncStorage from "@react-native-async-storage/async-storage";

export async function readJson<T>(key: string, fallback: T) {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeValue(key: string) {
  await AsyncStorage.removeItem(key);
}
