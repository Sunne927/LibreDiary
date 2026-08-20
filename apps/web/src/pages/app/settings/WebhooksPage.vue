<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWebhooksStore } from '@/stores/webhooks';
import { useToast } from '@/composables';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import BaseModal from '@/components/ui/BaseModal.vue';
import type { Webhook, CreateWebhookInput, UpdateWebhookInput } from '@librediary/shared';

const webhooksStore = useWebhooksStore();
const toast = useToast();
const { locale } = useI18n();
const isChinese = computed(() => locale.value === 'zh-CN');

const loading = ref(true);

// Event categories
const eventCategories = [
  {
    label: 'Pages',
    events: ['page.created', 'page.updated', 'page.deleted'],
  },
  {
    label: 'Databases',
    events: ['database.created', 'database.updated', 'database.deleted'],
  },
  {
    label: 'Comments',
    events: ['comment.created', 'comment.resolved'],
  },
  {
    label: 'Members',
    events: ['member.added', 'member.removed'],
  },
  {
    label: 'System',
    events: ['backup.completed'],
  },
];

// Create webhook modal
const showCreateModal = ref(false);
const createForm = reactive({
  name: '',
  url: '',
  events: [] as string[],
});
const createErrors = reactive({
  name: '',
  url: '',
  events: '',
});

// Edit webhook modal
const showEditModal = ref(false);
const editingWebhookId = ref('');
const editForm = reactive({
  name: '',
  url: '',
  events: [] as string[],
  isActive: true,
});
const editErrors = reactive({
  name: '',
  url: '',
  events: '',
});

// Confirm dialog
const showConfirmDialog = ref(false);
const confirmDialogConfig = ref({
  title: '',
  message: '',
  confirmText: '确认',
  variant: 'destructive' as 'default' | 'destructive',
  onConfirm: () => {},
});

// Testing state
const testingId = ref<string | null>(null);

onMounted(async () => {
  loading.value = true;
  try {
    await webhooksStore.fetchWebhooks();
  } catch (error) {
    console.error('Failed to load webhooks:', error);
  } finally {
    loading.value = false;
  }
});

function openCreateModal() {
  createForm.name = '';
  createForm.url = '';
  createForm.events = [];
  createErrors.name = '';
  createErrors.url = '';
  createErrors.events = '';
  showCreateModal.value = true;
}

function validateCreateForm(): boolean {
  let valid = true;
  createErrors.name = '';
  createErrors.url = '';
  createErrors.events = '';

  if (!createForm.name.trim()) {
    createErrors.name = isChinese.value ? '请输入名称' : 'Name is required';
    valid = false;
  }
  if (!createForm.url.trim()) {
    createErrors.url = isChinese.value ? '请输入网址' : 'URL is required';
    valid = false;
  } else {
    try {
      new URL(createForm.url);
    } catch {
      createErrors.url = isChinese.value ? '网址格式无效' : 'Invalid URL';
      valid = false;
    }
  }
  if (createForm.events.length === 0) {
    createErrors.events = isChinese.value ? '请至少选择一个事件' : 'Select at least one event';
    valid = false;
  }

  return valid;
}

async function handleCreateWebhook() {
  if (!validateCreateForm()) return;

  showCreateModal.value = false;

  try {
    const input: CreateWebhookInput = {
      name: createForm.name.trim(),
      url: createForm.url.trim(),
      events: createForm.events as CreateWebhookInput['events'],
    };
    await webhooksStore.createWebhook(input);
    toast.success('Webhook 已创建');
  } catch (error) {
    console.error('Failed to create webhook:', error);
    toast.error('创建 Webhook 失败');
  }
}

function openEditModal(webhook: Webhook) {
  editingWebhookId.value = webhook.id;
  editForm.name = webhook.name;
  editForm.url = webhook.url;
  editForm.events = [...webhook.events];
  editForm.isActive = webhook.isActive;
  editErrors.name = '';
  editErrors.url = '';
  editErrors.events = '';
  showEditModal.value = true;
}

function validateEditForm(): boolean {
  let valid = true;
  editErrors.name = '';
  editErrors.url = '';
  editErrors.events = '';

  if (!editForm.name.trim()) {
    editErrors.name = isChinese.value ? '请输入名称' : 'Name is required';
    valid = false;
  }
  if (!editForm.url.trim()) {
    editErrors.url = isChinese.value ? '请输入网址' : 'URL is required';
    valid = false;
  } else {
    try {
      new URL(editForm.url);
    } catch {
      editErrors.url = isChinese.value ? '网址格式无效' : 'Invalid URL';
      valid = false;
    }
  }
  if (editForm.events.length === 0) {
    editErrors.events = isChinese.value ? '请至少选择一个事件' : 'Select at least one event';
    valid = false;
  }

  return valid;
}

async function handleUpdateWebhook() {
  if (!validateEditForm()) return;

  showEditModal.value = false;

  try {
    const input: UpdateWebhookInput = {
      name: editForm.name.trim(),
      url: editForm.url.trim(),
      events: editForm.events as UpdateWebhookInput['events'],
      isActive: editForm.isActive,
    };
    await webhooksStore.updateWebhook(editingWebhookId.value, input);
    toast.success('Webhook 已更新');
  } catch (error) {
    console.error('Failed to update webhook:', error);
    toast.error('更新 Webhook 失败');
  }
}

async function handleTestWebhook(webhook: Webhook) {
  testingId.value = webhook.id;
  try {
    await webhooksStore.testWebhook(webhook.id);
    toast.success('测试事件已发送');
  } catch (error) {
    console.error('Failed to test webhook:', error);
    toast.error('发送测试事件失败');
  } finally {
    testingId.value = null;
  }
}

function confirmDelete(webhook: Webhook) {
  confirmDialogConfig.value = {
    title: isChinese.value ? '删除 Webhook' : 'Delete Webhook',
    message: isChinese.value
      ? `确定要删除“${webhook.name}”吗？此操作无法撤销。`
      : `Are you sure you want to delete "${webhook.name}"? This action cannot be undone.`,
    confirmText: isChinese.value ? '删除 Webhook' : 'Delete Webhook',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await webhooksStore.deleteWebhook(webhook.id);
        toast.success('Webhook 已删除');
      } catch (error) {
        console.error('Failed to delete webhook:', error);
        toast.error('删除 Webhook 失败');
      }
    },
  };
  showConfirmDialog.value = true;
}

function toggleCreateEvent(event: string) {
  const idx = createForm.events.indexOf(event);
  if (idx === -1) {
    createForm.events.push(event);
  } else {
    createForm.events.splice(idx, 1);
  }
}

function toggleEditEvent(event: string) {
  const idx = editForm.events.indexOf(event);
  if (idx === -1) {
    editForm.events.push(event);
  } else {
    editForm.events.splice(idx, 1);
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(isChinese.value ? 'zh-CN' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function truncateUrl(url: string, maxLen = 40): string {
  if (url.length <= maxLen) return url;
  return url.substring(0, maxLen) + '...';
}

function formatEventName(event: string): string {
  if (!isChinese.value) return event.replace('.', ' ');
  const labels: Record<string, string> = {
    'page.created': '页面创建', 'page.updated': '页面更新', 'page.deleted': '页面删除',
    'database.created': '数据库创建', 'database.updated': '数据库更新', 'database.deleted': '数据库删除',
    'comment.created': '评论创建', 'comment.resolved': '评论已解决',
    'member.added': '成员加入', 'member.removed': '成员移除', 'backup.completed': '备份完成',
  };
  return labels[event] ?? event.replace('.', ' ');
}

function eventCategoryLabel(label: string): string {
  if (!isChinese.value) return label;
  return ({ Pages: '页面', Databases: '数据库', Comments: '评论', Members: '成员', System: '系统' } as Record<string, string>)[label] ?? label;
}
</script>

<template>
  <div class="webhooks-page">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">{{ isChinese ? 'Webhook 管理' : 'Webhooks' }}</h1>
        <p class="page-description">
          {{ isChinese ? '事件发生时向外部服务发送实时通知' : 'Send real-time notifications to external services when events occur' }}
        </p>
      </div>
      <button class="btn-primary" :disabled="webhooksStore.creating" @click="openCreateModal">
        <svg
          v-if="webhooksStore.creating"
          class="spinner"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            stroke-width="2"
            stroke-dasharray="28"
            stroke-dashoffset="8"
            stroke-linecap="round"
          />
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 3V13M3 8H13"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
        {{ webhooksStore.creating ? (isChinese ? '正在创建...' : 'Creating...') : (isChinese ? '创建 Webhook' : 'Create Webhook') }}
      </button>
    </div>

    <!-- Webhooks Table -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ isChinese ? '名称' : 'Name' }}</th>
            <th>{{ isChinese ? '网址' : 'URL' }}</th>
            <th>{{ isChinese ? '事件' : 'Events' }}</th>
            <th>{{ isChinese ? '状态' : 'Status' }}</th>
            <th>{{ isChinese ? '创建时间' : 'Created' }}</th>
            <th class="actions-col">{{ isChinese ? '操作' : 'Actions' }}</th>
          </tr>
        </thead>
        <tbody>
          <!-- Loading -->
          <template v-if="loading">
            <tr v-for="i in 3" :key="i" class="skeleton-row">
              <td><div class="skeleton-name"></div></td>
              <td><div class="skeleton-url"></div></td>
              <td><div class="skeleton-badge"></div></td>
              <td><div class="skeleton-badge"></div></td>
              <td><div class="skeleton-short"></div></td>
              <td><div class="skeleton-actions"></div></td>
            </tr>
          </template>

          <!-- Empty State -->
          <tr v-else-if="webhooksStore.webhooks.length === 0">
            <td colspan="6" class="empty-cell">
              <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path
                    d="M12 24C12 17.3726 17.3726 12 24 12"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                  <path
                    d="M36 24C36 30.6274 30.6274 36 24 36"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                  <circle cx="24" cy="12" r="3" stroke="currentColor" stroke-width="2" />
                  <circle cx="24" cy="36" r="3" stroke="currentColor" stroke-width="2" />
                  <path
                    d="M24 24L32 18"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                  <circle cx="24" cy="24" r="2" fill="currentColor" />
                </svg>
                <span>{{ isChinese ? '暂无 Webhook。创建第一个 Webhook 即可开始。' : 'No webhooks yet' }}</span>
              </div>
            </td>
          </tr>

          <!-- Webhook Rows -->
          <tr v-for="webhook in webhooksStore.webhooks" v-else :key="webhook.id">
            <td>
              <span class="webhook-name">{{ webhook.name }}</span>
            </td>
            <td>
              <code class="webhook-url" :title="webhook.url">{{ truncateUrl(webhook.url) }}</code>
            </td>
            <td>
              <span class="events-count">
                {{ isChinese ? `${webhook.events.length} 个事件` : `${webhook.events.length} event${webhook.events.length !== 1 ? 's' : ''}` }}
              </span>
            </td>
            <td>
              <span class="badge" :class="webhook.isActive ? 'badge-success' : 'badge-inactive'">
                {{ webhook.isActive ? (isChinese ? '已启用' : 'Active') : (isChinese ? '已停用' : 'Inactive') }}
              </span>
            </td>
            <td>
              <span class="date-text">{{ formatDate(webhook.createdAt) }}</span>
            </td>
            <td>
              <div class="actions">
                <button
                  class="action-btn"
                  :title="isChinese ? '发送测试事件' : 'Send test event'"
                  :disabled="testingId === webhook.id"
                  @click="handleTestWebhook(webhook)"
                >
                  <svg
                    v-if="testingId === webhook.id"
                    class="spinner"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="6"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-dasharray="28"
                      stroke-dashoffset="8"
                      stroke-linecap="round"
                    />
                  </svg>
                  <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M5 3L13 8L5 13V3Z"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
                <button class="action-btn" :title="isChinese ? '编辑 Webhook' : 'Edit webhook'" @click="openEditModal(webhook)">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M11.5 2.5L13.5 4.5L5 13H3V11L11.5 2.5Z"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
                <button
                  class="action-btn danger"
                  :title="isChinese ? '删除 Webhook' : 'Delete webhook'"
                  @click="confirmDelete(webhook)"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3 5H13"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    />
                    <path
                      d="M6 5V3.5C6 3.22386 6.22386 3 6.5 3H9.5C9.77614 3 10 3.22386 10 3.5V5"
                      stroke="currentColor"
                      stroke-width="1.5"
                    />
                    <path
                      d="M4 5L5 13C5 13.5523 5.44772 14 6 14H10C10.5523 14 11 13.5523 11 13L12 5"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create Webhook Modal -->
    <BaseModal :open="showCreateModal" @close="showCreateModal = false">
      <div class="webhook-modal">
        <h2 class="modal-title">创建 Webhook</h2>
          <p class="modal-description">配置一个用于接收事件通知的地址。</p>

        <div class="form-field">
          <label class="field-label" for="create-name">名称</label>
          <input
            id="create-name"
            v-model="createForm.name"
            type="text"
            class="field-input"
            placeholder="例如：Slack 通知"
            maxlength="100"
          />
          <p v-if="createErrors.name" class="field-error">{{ createErrors.name }}</p>
        </div>

        <div class="form-field">
          <label class="field-label" for="create-url">网址</label>
          <input
            id="create-url"
            v-model="createForm.url"
            type="url"
            class="field-input"
            placeholder="https://example.com/webhooks"
          />
          <p v-if="createErrors.url" class="field-error">{{ createErrors.url }}</p>
        </div>

        <div class="form-field">
          <span class="field-label">事件</span>
          <div class="events-grid">
            <div v-for="category in eventCategories" :key="category.label" class="event-category">
              <span class="category-label">{{ eventCategoryLabel(category.label) }}</span>
              <label v-for="event in category.events" :key="event" class="event-checkbox">
                <input
                  type="checkbox"
                  class="checkbox"
                  :checked="createForm.events.includes(event)"
                  @change="toggleCreateEvent(event)"
                />
                <span class="event-name">{{ formatEventName(event) }}</span>
              </label>
            </div>
          </div>
          <p v-if="createErrors.events" class="field-error">{{ createErrors.events }}</p>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showCreateModal = false">取消</button>
          <button class="btn btn-primary" @click="handleCreateWebhook">创建 Webhook</button>
        </div>
      </div>
    </BaseModal>

    <!-- Edit Webhook Modal -->
    <BaseModal :open="showEditModal" @close="showEditModal = false">
      <div class="webhook-modal">
        <h2 class="modal-title">编辑 Webhook</h2>

        <div class="form-field">
          <label class="field-label" for="edit-name">名称</label>
          <input
            id="edit-name"
            v-model="editForm.name"
            type="text"
            class="field-input"
            maxlength="100"
          />
          <p v-if="editErrors.name" class="field-error">{{ editErrors.name }}</p>
        </div>

        <div class="form-field">
          <label class="field-label" for="edit-url">网址</label>
          <input id="edit-url" v-model="editForm.url" type="url" class="field-input" />
          <p v-if="editErrors.url" class="field-error">{{ editErrors.url }}</p>
        </div>

        <div class="form-field">
          <label class="toggle-label">
            <input v-model="editForm.isActive" type="checkbox" class="checkbox" />
            <span>启用</span>
          </label>
        </div>

        <div class="form-field">
          <span class="field-label">事件</span>
          <div class="events-grid">
            <div v-for="category in eventCategories" :key="category.label" class="event-category">
              <span class="category-label">{{ eventCategoryLabel(category.label) }}</span>
              <label v-for="event in category.events" :key="event" class="event-checkbox">
                <input
                  type="checkbox"
                  class="checkbox"
                  :checked="editForm.events.includes(event)"
                  @change="toggleEditEvent(event)"
                />
                <span class="event-name">{{ formatEventName(event) }}</span>
              </label>
            </div>
          </div>
          <p v-if="editErrors.events" class="field-error">{{ editErrors.events }}</p>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showEditModal = false">取消</button>
          <button class="btn btn-primary" @click="handleUpdateWebhook">保存更改</button>
        </div>
      </div>
    </BaseModal>

    <!-- Confirm Dialog -->
    <ConfirmDialog
      :open="showConfirmDialog"
      :title="confirmDialogConfig.title"
      :message="confirmDialogConfig.message"
      :confirm-text="confirmDialogConfig.confirmText"
      :variant="confirmDialogConfig.variant"
      @confirm="confirmDialogConfig.onConfirm"
      @close="showConfirmDialog = false"
    />
  </div>
</template>

<style scoped>
.webhooks-page {
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: var(--space-1);
}

.page-description {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

/* Primary Button */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-inverse);
  background: var(--color-accent);
  border: none;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Table */
.table-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: var(--space-3) var(--space-4);
  text-align: left;
  border-bottom: 1px solid var(--color-border-subtle);
}

.data-table th {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--color-surface-sunken);
}

.data-table tr:last-child td {
  border-bottom: none;
}

.actions-col {
  width: 120px;
  text-align: right !important;
}

.webhook-name {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-primary);
}

.webhook-url {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  font-family: var(--font-mono, monospace);
}

.events-count {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.date-text {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}

/* Badge */
.badge {
  display: inline-flex;
  padding: 2px 8px;
  font-size: var(--text-xs);
  font-weight: 500;
  border-radius: var(--radius-full);
}

.badge-success {
  color: var(--color-success);
  background: var(--color-success-subtle);
}

.badge-inactive {
  color: var(--color-text-tertiary);
  background: var(--color-surface-sunken);
}

/* Actions */
.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  color: var(--color-text-secondary);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.action-btn:hover:not(:disabled) {
  color: var(--color-text-primary);
  background: var(--color-hover);
  border-color: var(--color-border-strong);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn.danger:hover {
  color: var(--color-error);
  background: var(--color-error-subtle);
  border-color: var(--color-error);
}

/* Modal */
.webhook-modal {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text-primary);
}

.modal-description {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-top: calc(-1 * var(--space-2));
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-primary);
}

.field-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-family: inherit;
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  outline: none;
  transition: all var(--transition-fast);
}

.field-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-subtle, rgba(59, 130, 246, 0.15));
}

.field-error {
  font-size: var(--text-xs);
  color: var(--color-error);
}

/* Events grid */
.events-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  max-height: 280px;
  overflow-y: auto;
}

.event-category {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.category-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.event-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-left: var(--space-2);
  cursor: pointer;
}

.checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--color-accent);
  cursor: pointer;
}

.event-name {
  font-size: var(--text-sm);
  color: var(--color-text-primary);
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-primary);
  cursor: pointer;
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  padding-top: var(--space-2);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-width: 100px;
  padding: var(--space-2) var(--space-5);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 500;
  line-height: 1.5;
  cursor: pointer;
  border: none;
  border-radius: var(--radius-lg);
  transition: all 0.15s ease;
}

.modal-actions .btn-secondary {
  color: var(--color-text-secondary);
  background: var(--color-surface-sunken);
  border: 1px solid var(--color-border);
}

.modal-actions .btn-secondary:hover {
  color: var(--color-text-primary);
  background: var(--color-hover);
  border-color: var(--color-border-strong);
}

.modal-actions .btn-primary {
  min-width: 100px;
  padding: var(--space-2) var(--space-5);
  color: var(--color-text-inverse);
  background: var(--color-accent);
}

.modal-actions .btn-primary:hover {
  background: var(--color-accent-hover);
}

/* Empty State */
.empty-cell {
  padding: var(--space-12) !important;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  color: var(--color-text-tertiary);
  text-align: center;
}

/* Skeleton Loading */
.skeleton-row td {
  padding: var(--space-4);
}

.skeleton-badge {
  width: 60px;
  height: 22px;
  background: var(--color-surface-sunken);
  border-radius: var(--radius-full);
  animation: pulse-subtle 1.5s ease-in-out infinite;
}

.skeleton-short {
  width: 60px;
  height: 16px;
  background: var(--color-surface-sunken);
  border-radius: var(--radius-sm);
  animation: pulse-subtle 1.5s ease-in-out infinite;
}

.skeleton-name {
  width: 100px;
  height: 16px;
  background: var(--color-surface-sunken);
  border-radius: var(--radius-sm);
  animation: pulse-subtle 1.5s ease-in-out infinite;
}

.skeleton-url {
  width: 180px;
  height: 16px;
  background: var(--color-surface-sunken);
  border-radius: var(--radius-sm);
  animation: pulse-subtle 1.5s ease-in-out infinite;
}

.skeleton-actions {
  width: 100px;
  height: 32px;
  margin-left: auto;
  background: var(--color-surface-sunken);
  border-radius: var(--radius-md);
  animation: pulse-subtle 1.5s ease-in-out infinite;
}

/* Spinner */
.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse-subtle {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
