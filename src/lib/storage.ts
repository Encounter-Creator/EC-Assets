import * as SecureStore from "expo-secure-store";

const memory = new Map<string, string>();

export async function setItem(key: string, value: string) {
  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  memory.set(key, value);
}

export async function getItem(key: string) {
  if (await SecureStore.isAvailableAsync()) {
    return SecureStore.getItemAsync(key);
  }

  return memory.get(key) ?? null;
}

export async function deleteItem(key: string) {
  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.deleteItemAsync(key);
    return;
  }

  memory.delete(key);
}
