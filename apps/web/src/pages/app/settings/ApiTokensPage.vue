<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useApiTokensStore } from '@/stores/api-tokens';
import { useToast } from '@/composables';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import BaseModal from '@/components/ui/BaseModal.vue';
import type { ApiToken } from '@librediary/shared';

const apiTokensStore = useApiTokensStore();
const toast = useToast();
const { locale } = useI18n();
const isChinese = computed(() => locale.value === 'zh-CN');

const loading = ref(true);

// Create token modal
const showCreateModal = ref(false);
const tokenName = ref('');
const tokenExpiry = ref('');
const nameError = ref('');

// Token display modal
const showTokenModal = ref(false);
const rawToken = ref('');
const copied = ref(false);

// Confirm dialog
const showConfirmDialog = ref(false);
const confirmDialogConfig = ref({
  title: '',
  message: '',
  confirmText: '确认',
  variant: 'destructive' as 'default' | 'destructive',
  onConfirm: () => {},
});

onMounted(async () => {
  loading.value = true;
  try {
    await apiTokensStore.fetchTokens();
  } catch (error) {
    console.error('Failed to load tokens:', error);
  } finally {
    loading.value = false;
  }
});

function openCreateModal() {
  tokenName.value = '';
  tokenExpiry.value = '';
  nameError.value = '';
  showCreateModal.value = true;
}

function getMinDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0] ?? '';
}

async function handleCreateToken() {
  if (!tokenName.value.trim()) {
    nameError.value = '请输入名称';
    return;
  }
  if (tokenName.value.trim().length > 100) {
    nameError.value = isChinese.value ? '名称不能超过 100 个字符' : 'Name must be 100 characters or fewer';
    return;
  }

  showCreateModal.value = false;

  try {
    const expiresAt = tokenExpiry.value
      ? new Date(tokenExpiry.value + 'T23:59:59Z').toISOString()
      : undefined;
    const token = await apiTokensStore.createToken(tokenName.value.trim(), expiresAt);
    rawToken.value = (token as any).rawToken ?? '';
    copied.value = false;
    showTokenModal.value = true;
  } catch (error) {
    console.error('Failed to create token:', error);
  toast.error('创建令牌失败');
  }
}

async function copyToken() {
  try {
    await navigator.clipboard.writeText(rawToken.value);
    copied.value = true;
  toast.success('令牌已复制到剪贴板');
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
  toast.error('复制令牌失败');
  }
}

function confirmDelete(token: ApiToken) {
  confirmDialogConfig.value = {
    title: isChinese.value ? '删除令牌' : 'Delete Token',
    message: isChinese.value
      ? `确定要删除“${token.name}”吗？使用此令牌的应用将立即失去访问权限。`
      : `Are you sure you want to delete "${token.name}"? Any applications using this token will lose access immediately.`,
    confirmText: isChinese.value ? '删除令牌' : 'Delete Token',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await apiTokensStore.deleteToken(token.id);
        toast.success('令牌已删除');
      } catch (error) {
        console.error('Failed to delete token:', error);
        toast.error('删除令牌失败');
      }
    },
  };
  showConfirmDialog.value = true;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(isChinese.value ? 'zh-CN' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function isExpired(token: ApiToken): boolean {
  if (!token.expiresAt) return false;
  return new Date(token.expiresAt) < new Date();
}
</script>

<template>
  <div class="tokens-page">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">{{ isChinese ? 'API 令牌' : 'API Tokens' }}</h1>
        <p class="page-description">
          {{ isChinese ? '创建和管理用于程序访问的个人 API 令牌' : 'Create and manage personal API tokens for programmatic access' }}
        </p>
      </div>
      <button class="btn-primary" :disabled="apiTokensStore.creating" @click="openCreateModal">
        <svg
          v-if="apiTokensStore.creating"
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
        {{ apiTokensStore.creating ? (isChinese ? '正在创建...' : 'Creating...') : (isChinese ? '创建令牌' : 'Create Token') }}
      </button>
    </div>

    <!-- Tokens Table -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ isChinese ? '名称' : 'Name' }}</th>
            <th>{{ isChinese ? '令牌' : 'Token' }}</th>
            <th>{{ isChinese ? '上次使用' : 'Last Used' }}</th>
            <th>{{ isChinese ? '过期时间' : 'Expires' }}</th>
            <th>{{ isChinese ? '创建时间' : 'Created' }}</th>
            <th class="actions-col">{{ isChinese ? '操作' : 'Actions' }}</th>
          </tr>
        </thead>
        <tbody>
          <!-- Loading -->
          <template v-if="loading">
            <tr v-for="i in 3" :key="i" class="skeleton-row">
              <td><div class="skeleton-name"></div></td>
              <td><div class="skeleton-short"></div></td>
              <td><div class="skeleton-short"></div></td>
              <td><div class="skeleton-short"></div></td>
              <td><div class="skeleton-short"></div></td>
              <td><div class="skeleton-actions"></div></td>
            </tr>
          </template>

          <!-- Empty State -->
          <tr v-else-if="apiTokensStore.tokens.length === 0">
            <td colspan="6" class="empty-cell">
              <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path
                    d="M30 18C30 14.6863 27.3137 12 24 12C20.6863 12 18 14.6863 18 18C18 20.2091 19.2066 22.1358 21 23.1973V30H27V23.1973C28.7934 22.1358 30 20.2091 30 18Z"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M21 27H27"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="18"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-dasharray="4 4"
                  />
                </svg>
                <span>{{ isChinese ? '暂无 API 令牌。创建第一个令牌即可开始。' : 'No API tokens yet' }}</span>
              </div>
            </td>
          </tr>

          <!-- Token Rows -->
          <tr v-for="token in apiTokensStore.tokens" v-else :key="token.id">
            <td>
              <span class="token-name">{{ token.name }}</span>
            </td>
            <td>
              <code class="token-prefix">{{ token.tokenPrefix }}...</code>
            </td>
            <td>
              <span class="date-text">
                {{ token.lastUsedAt ? formatDate(token.lastUsedAt) : (isChinese ? '从未使用' : 'Never') }}
              </span>
            </td>
            <td>
                <span v-if="!token.expiresAt" class="date-text">{{ isChinese ? '永不过期' : 'Never' }}</span>
              <span v-else class="date-text" :class="{ expired: isExpired(token) }">
                {{ formatDate(token.expiresAt) }}
                <span v-if="isExpired(token)" class="badge badge-error">{{ isChinese ? '已过期' : 'Expired' }}</span>
              </span>
            </td>
            <td>
              <span class="date-text">{{ formatDate(token.createdAt) }}</span>
            </td>
            <td>
              <div class="actions">
                <button
                  class="action-btn danger"
                  :title="isChinese ? '删除令牌' : 'Delete token'"
                  @click="confirmDelete(token)"
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

    <!-- Create Token Modal -->
    <BaseModal :open="showCreateModal" @close="showCreateModal = false">
      <div class="create-modal">
        <h2 class="modal-title">创建 API 令牌</h2>
        <p class="modal-description">令牌允许其他程序代表你访问 API。</p>

        <div class="form-field">
          <label class="field-label" for="token-name">名称</label>
          <input
            id="token-name"
            v-model="tokenName"
            type="text"
            class="field-input"
            placeholder="例如：自动部署"
            maxlength="100"
          />
          <p v-if="nameError" class="field-error">{{ nameError }}</p>
        </div>

        <div class="form-field">
          <label class="field-label" for="token-expiry">过期日期（选填）</label>
          <input
            id="token-expiry"
            v-model="tokenExpiry"
            type="date"
            class="field-input"
            :min="getMinDate()"
          />
          <p class="field-hint">留空则令牌永不过期</p>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showCreateModal = false">取消</button>
          <button class="btn btn-primary" @click="handleCreateToken">创建令牌</button>
        </div>
      </div>
    </BaseModal>

    <!-- Token Display Modal -->
    <BaseModal :open="showTokenModal" @close="showTokenModal = false">
      <div class="create-modal">
        <h2 class="modal-title">令牌已创建</h2>
        <p class="modal-description warning-text">
          {{ isChinese ? '请立即复制令牌，关闭后将无法再次查看。' : "Copy your token now. You won't be able to see it again." }}
        </p>

        <div class="token-display">
          <code class="token-value">{{ rawToken }}</code>
          <button class="copy-btn" :class="{ copied }" @click="copyToken">
            <svg v-if="!copied" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect
                x="5"
                y="5"
                width="9"
                height="9"
                rx="1.5"
                stroke="currentColor"
                stroke-width="1.5"
              />
              <path
                d="M11 5V3.5C11 2.67157 10.3284 2 9.5 2H3.5C2.67157 2 2 2.67157 2 3.5V9.5C2 10.3284 2.67157 11 3.5 11H5"
                stroke="currentColor"
                stroke-width="1.5"
              />
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 8L7 11L12 5"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            {{ copied ? (isChinese ? '已复制' : 'Copied') : (isChinese ? '复制' : 'Copy') }}
          </button>
        </div>

        <div class="modal-actions">
          <button class="btn btn-primary" @click="showTokenModal = false">完成</button>
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
.tokens-page {
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
  width: 80px;
  text-align: right !important;
}

.token-name {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-primary);
}

.token-prefix {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  font-family: var(--font-mono, monospace);
  background: var(--color-surface-sunken);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

.date-text {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}

.expired {
  color: var(--color-error);
}

/* Badge */
.badge {
  display: inline-flex;
  padding: 2px 8px;
  font-size: var(--text-xs);
  font-weight: 500;
  border-radius: var(--radius-full);
  margin-left: var(--space-2);
  vertical-align: middle;
}

.badge-error {
  color: var(--color-error);
  background: var(--color-error-subtle);
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

.action-btn:hover {
  color: var(--color-text-primary);
  background: var(--color-hover);
  border-color: var(--color-border-strong);
}

.action-btn.danger:hover {
  color: var(--color-error);
  background: var(--color-error-subtle);
  border-color: var(--color-error);
}

/* Create Modal */
.create-modal {
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

.warning-text {
  color: var(--color-warning);
  font-weight: 500;
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

.field-hint {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

/* Token Display */
.token-display {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-surface-sunken);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.token-value {
  flex: 1;
  font-family: var(--font-mono, monospace);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  word-break: break-all;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  font-family: inherit;
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-text-secondary);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.copy-btn:hover {
  color: var(--color-text-primary);
  border-color: var(--color-border-strong);
}

.copy-btn.copied {
  color: var(--color-success);
  border-color: var(--color-success);
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

.skeleton-short {
  width: 60px;
  height: 16px;
  background: var(--color-surface-sunken);
  border-radius: var(--radius-sm);
  animation: pulse-subtle 1.5s ease-in-out infinite;
}

.skeleton-name {
  width: 120px;
  height: 16px;
  background: var(--color-surface-sunken);
  border-radius: var(--radius-sm);
  animation: pulse-subtle 1.5s ease-in-out infinite;
}

.skeleton-actions {
  width: 36px;
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
