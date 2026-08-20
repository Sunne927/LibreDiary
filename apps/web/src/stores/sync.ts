import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { i18n } from '@/i18n';

export type SyncStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface SyncOperation {
  id: string;
  type: string;
  status: SyncStatus;
  startedAt: number;
  error?: string;
}

export const useSyncStore = defineStore('sync', () => {
  // ===========================================
  // STATE
  // ===========================================

  const operations = ref<Map<string, SyncOperation>>(new Map());
  const lastSavedAt = ref<number | null>(null);

  // ===========================================
  // GETTERS
  // ===========================================

  /**
   * Current global sync status - prioritizes active states
   */
  const status = computed<SyncStatus>(() => {
    const ops = Array.from(operations.value.values());

    if (ops.some((op) => op.status === 'error')) {
      return 'error';
    }
    if (ops.some((op) => op.status === 'saving')) {
      return 'saving';
    }
    if (ops.some((op) => op.status === 'pending')) {
      return 'pending';
    }
    if (lastSavedAt.value && Date.now() - lastSavedAt.value < 2000) {
      return 'saved';
    }
    return 'idle';
  });

  /**
   * Whether there are any pending or saving operations
   */
  const isSyncing = computed(() => {
    return status.value === 'pending' || status.value === 'saving';
  });

  /**
   * Whether there are any errors
   */
  const hasError = computed(() => {
    return status.value === 'error';
  });

  /**
   * Human-readable status message
   */
  const statusMessage = computed(() => {
    const isChinese = String(i18n.global.locale.value) === 'zh-CN';
    switch (status.value) {
      case 'pending':
        return isChinese ? '等待保存...' : 'Waiting to save...';
      case 'saving':
        return isChinese ? '正在保存...' : 'Saving...';
      case 'saved':
        return isChinese ? '所有更改已保存' : 'All changes saved';
      case 'error':
        return isChinese ? '保存失败' : 'Failed to save';
      default:
        return '';
    }
  });

  // ===========================================
  // ACTIONS
  // ===========================================

  /**
   * Start tracking a new sync operation
   */
  function startOperation(id: string, type: string = 'content'): void {
    operations.value.set(id, {
      id,
      type,
      status: 'pending',
      startedAt: Date.now(),
    });
  }

  /**
   * Mark an operation as actively saving
   */
  function markSaving(id: string): void {
    const op = operations.value.get(id);
    if (op) {
      op.status = 'saving';
    }
  }

  /**
   * Mark an operation as completed successfully
   */
  function markSaved(id: string): void {
    operations.value.delete(id);
    lastSavedAt.value = Date.now();
  }

  /**
   * Mark an operation as failed
   */
  function markError(id: string, error?: string): void {
    const op = operations.value.get(id);
    if (op) {
      op.status = 'error';
      op.error = error;
    }
  }

  /**
   * Clear error state for an operation
   */
  function clearError(id: string): void {
    operations.value.delete(id);
  }

  /**
   * Clear all operations
   */
  function reset(): void {
    operations.value.clear();
    lastSavedAt.value = null;
  }

  return {
    // State
    operations,
    lastSavedAt,
    // Getters
    status,
    isSyncing,
    hasError,
    statusMessage,
    // Actions
    startOperation,
    markSaving,
    markSaved,
    markError,
    clearError,
    reset,
  };
});
