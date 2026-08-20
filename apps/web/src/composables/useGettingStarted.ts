import { ref, computed } from 'vue';
import { useAuthStore, usePagesStore } from '@/stores';

const STORAGE_KEY = 'librediary-getting-started';

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  route?: { name: string };
}

interface ChecklistState {
  dismissed: boolean;
  manuallyCompleted: string[];
}

function loadState(): ChecklistState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // Ignore
  }
  return { dismissed: false, manuallyCompleted: [] };
}

function saveState(state: ChecklistState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useGettingStarted() {
  const authStore = useAuthStore();
  const pagesStore = usePagesStore();

  const state = ref<ChecklistState>(loadState());

  const dismissed = computed(() => state.value.dismissed);

  const items = computed<ChecklistItem[]>(() => {
    const manual = state.value.manuallyCompleted;
    return [
      {
        id: 'create-page',
        title: '创建第一个页面',
        description: '从空白页面或模板开始记录。',
        completed: pagesStore.rootPages.length > 0 || manual.includes('create-page'),
        route: { name: 'dashboard' },
      },
      {
        id: 'set-profile',
        title: '完善个人资料',
        description: '添加你的名称和个人偏好。',
        completed: !!authStore.user?.name || manual.includes('set-profile'),
        route: { name: 'account-settings' },
      },
      {
        id: 'explore-templates',
        title: '浏览模板',
        description: '从预置模板中快速开始。',
        completed: manual.includes('explore-templates'),
        route: { name: 'templates' },
      },
      {
        id: 'invite-member',
        title: '邀请成员',
        description: '邀请其他成员加入你的工作区。',
        completed: manual.includes('invite-member'),
        route: { name: 'organization-invites' },
      },
    ];
  });

  const completedCount = computed(() => items.value.filter((i) => i.completed).length);
  const totalCount = computed(() => items.value.length);
  const allCompleted = computed(() => completedCount.value === totalCount.value);
  const progress = computed(() =>
    totalCount.value > 0 ? (completedCount.value / totalCount.value) * 100 : 0
  );

  // Show checklist if not dismissed and not all completed
  const isVisible = computed(() => !dismissed.value && !allCompleted.value);

  function markCompleted(id: string): void {
    if (!state.value.manuallyCompleted.includes(id)) {
      state.value.manuallyCompleted.push(id);
      saveState(state.value);
    }
  }

  function dismiss(): void {
    state.value.dismissed = true;
    saveState(state.value);
  }

  return {
    items,
    completedCount,
    totalCount,
    allCompleted,
    progress,
    isVisible,
    dismissed,
    markCompleted,
    dismiss,
  };
}
