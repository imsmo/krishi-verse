// apps/mobile/src/core/offline/kv.ts · the AsyncStorage-backed implementation of the OfflineQueue's KvPort.
// Kept separate so the queue stays framework-free + testable (tests inject an in-memory KV). Non-secret only —
// secrets go through token-store (SecureStore).
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KvPort } from '../api/offline-queue';

export const asyncStorageKv: KvPort = {
  get: (k) => AsyncStorage.getItem(k),
  set: (k, v) => AsyncStorage.setItem(k, v),
  remove: (k) => AsyncStorage.removeItem(k),
};
