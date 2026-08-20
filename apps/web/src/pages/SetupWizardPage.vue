<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useTheme } from '@/composables';
import { setupService, ApiError } from '@/services';
import { resetSetupStatus } from '@/router';

const router = useRouter();
const { theme, toggleTheme } = useTheme();

// Wizard state
const currentStep = ref(1);
const totalSteps = 3;
const loading = ref(false);
const error = ref('');
const setupComplete = ref(false);

// Form data
const siteName = ref('LibreDiary');
const adminEmail = ref('');
const adminPassword = ref('');
const adminPasswordConfirm = ref('');
const adminName = ref('');
function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      // Prior collapse leaves at most one leading/trailing '-', so single-char
      // anchored strips suffice — and avoid the ReDoS-prone /^-+|-+$/.
      .replace(/^-/, '')
      .replace(/-$/, '')
      .slice(0, 63)
  );
}

// Validation
const step1Valid = computed(() => siteName.value.trim().length > 0);

const step2Valid = computed(() => {
  const email = adminEmail.value;
  // eslint-disable-next-line redos/no-vulnerable -- admin-only setup field, length-capped below (RFC 5321 max); not attacker-reachable
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return (
    email.length <= 254 &&
    emailRegex.test(email) &&
    adminPassword.value.length >= 8 &&
    adminPassword.value === adminPasswordConfirm.value
  );
});

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 1:
      return step2Valid.value;
    case 2:
      return step1Valid.value;
    default:
      return false;
  }
});

// Password strength indicator
const passwordStrength = computed(() => {
  const pwd = adminPassword.value;
  if (pwd.length === 0) return { level: 0, label: '' };
  if (pwd.length < 8) return { level: 1, label: 'Too short' };

  let score = 0;
  if (pwd.length >= 12) score++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;

  if (score <= 1) return { level: 2, label: 'Weak' };
  if (score === 2) return { level: 3, label: 'Fair' };
  if (score === 3) return { level: 4, label: 'Good' };
  return { level: 5, label: 'Strong' };
});

// Navigation
function nextStep() {
  if (currentStep.value < totalSteps && canProceed.value) {
    error.value = '';
    currentStep.value++;
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    error.value = '';
    currentStep.value--;
  }
}

// Submit setup
async function completeSetup() {
  if (!canProceed.value) return;

  loading.value = true;
  error.value = '';

  try {
    await setupService.complete({
      siteName: siteName.value,
      admin: {
        email: adminEmail.value,
        password: adminPassword.value,
        name: adminName.value || undefined,
      },
      organization: {
        name: siteName.value.trim(),
        slug: slugify(siteName.value) || 'personal-workspace',
      },
    });

    // Reset the router's setup status cache so navigation works
    resetSetupStatus();

    setupComplete.value = true;
    currentStep.value = 3;
  } catch (err) {
    if (err instanceof ApiError) {
      error.value = err.message;
    } else {
      error.value = '发生了意外错误';
    }
  } finally {
    loading.value = false;
  }
}

function goToLogin() {
  router.push('/login');
}
</script>

<template>
  <div class="setup-page">
    <!-- Animated background elements -->
    <div class="bg-decoration">
      <div class="leaf leaf-1"></div>
      <div class="leaf leaf-2"></div>
      <div class="leaf leaf-3"></div>
      <div class="glow"></div>
    </div>

    <!-- Theme Toggle -->
    <button class="theme-toggle" title="切换颜色主题" @click="toggleTheme">
      <svg v-if="theme === 'light'" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="4" stroke="currentColor" stroke-width="1.5" />
        <path
          d="M10 2.5V4M10 16V17.5M2.5 10H4M16 10H17.5M4.7 4.7L5.76 5.76M14.24 14.24L15.3 15.3M4.7 15.3L5.76 14.24M14.24 5.76L15.3 4.7"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
      <svg v-else-if="theme === 'dark'" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M17.5 11.5C16.5 12.5 15.1 13.1 13.6 13.1C10.5 13.1 8 10.6 8 7.5C8 5.9 8.6 4.5 9.6 3.5C5.8 4.2 3 7.5 3 11.5C3 16 6.6 19.5 11 19.5C15 19.5 18.3 16.7 19 12.9C18.6 12.5 18.1 12 17.5 11.5Z"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <svg v-else width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect
          x="2.5"
          y="4"
          width="15"
          height="11"
          rx="1.5"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <path d="M6.5 18H13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <path d="M10 15V18" stroke="currentColor" stroke-width="1.5" />
      </svg>
    </button>

    <div class="setup-container">
      <!-- Logo & Title -->
      <div class="setup-header">
        <div class="logo">
          <svg class="logo-icon" width="48" height="48" viewBox="0 0 28 28" fill="none">
            <rect
              x="4"
              y="3"
              width="16"
              height="22"
              rx="2"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M8 8H16M8 12H16M8 16H12"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
            <path
              d="M20 7V23C20 24.1046 20.8954 25 22 25H22C23.1046 25 24 24.1046 24 23V7"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </div>
        <h1 class="title">{{ $t('setup.welcomeToLibreDiary') }}</h1>
        <p class="subtitle">{{ $t('setup.setupDescription') }}</p>
      </div>

      <!-- Progress Indicator -->
      <div v-if="currentStep < 3" class="progress-container">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }"
          ></div>
        </div>
        <div class="progress-steps">
          <div
            v-for="step in totalSteps - 1"
            :key="step"
            class="progress-step"
            :class="{
              active: step === currentStep,
              completed: step < currentStep,
            }"
          >
            <div class="step-dot">
              <svg v-if="step < currentStep" width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2.5 6L5 8.5L9.5 4"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span v-else>{{ step }}</span>
            </div>
            <span class="step-label">{{
              ['访问凭证', $t('setup.stepSite')][step - 1]
            }}</span>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <Transition name="fade">
        <div v-if="error" class="error-banner">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.5" />
            <path
              d="M9 5.5V9.5M9 12V12.01"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
          <span>{{ error }}</span>
        </div>
      </Transition>

      <!-- Step Content -->
      <div class="step-content">
        <Transition name="slide" mode="out-in">
          <!-- Step 1: Access Credentials -->
          <div v-if="currentStep === 1" key="step1" class="step-panel">
            <div class="step-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect
                  x="4"
                  y="4"
                  width="24"
                  height="24"
                  rx="4"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
                <path
                  d="M10 14H22M10 18H18"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
                <circle cx="16" cy="10" r="2" stroke="currentColor" stroke-width="1.5" />
              </svg>
            </div>
            <h2>设置访问密码</h2>
            <p class="step-description">
              这是你的私人工作区，密码仅供你本人使用。
            </p>

            <div class="form-grid">
              <div class="form-field">
                <label for="adminName">显示名称 <span class="optional">（选填）</span></label>
                <input
                  id="adminName"
                  v-model="adminName"
                  type="text"
                  placeholder="你的姓名"
                  maxlength="255"
                  autocomplete="name"
                />
              </div>

              <div class="form-field">
                <label for="adminEmail">登录邮箱</label>
                <input
                  id="adminEmail"
                  v-model="adminEmail"
                  type="email"
                  :placeholder="$t('auth.emailPlaceholder')"
                  required
                  autocomplete="email"
                />
              </div>

              <div class="form-field">
                <label for="adminPassword">访问密码</label>
                <input
                  id="adminPassword"
                  v-model="adminPassword"
                  type="password"
                  :placeholder="$t('auth.newPasswordPlaceholder')"
                  required
                  minlength="8"
                  autocomplete="new-password"
                />
                <div v-if="adminPassword.length > 0" class="password-strength">
                  <div class="strength-bar">
                    <div class="strength-fill" :class="`level-${passwordStrength.level}`"></div>
                  </div>
                  <span class="strength-label" :class="`level-${passwordStrength.level}`">{{
                    passwordStrength.label
                  }}</span>
                </div>
              </div>

              <div class="form-field">
                <label for="adminPasswordConfirm">确认访问密码</label>
                <input
                  id="adminPasswordConfirm"
                  v-model="adminPasswordConfirm"
                  type="password"
                  :placeholder="$t('auth.confirmPasswordPlaceholder')"
                  required
                  autocomplete="new-password"
                />
                <span
                  v-if="adminPasswordConfirm && adminPassword !== adminPasswordConfirm"
                  class="field-error"
                  >两次输入的密码不一致</span
                >
              </div>
            </div>
          </div>

          <!-- Step 2: Site Name -->
          <div v-else-if="currentStep === 2" key="step2" class="step-panel">
            <div class="step-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect
                  x="4"
                  y="4"
                  width="24"
                  height="24"
                  rx="4"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
                <path
                  d="M10 14H22M10 18H18"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
                <circle cx="16" cy="10" r="2" stroke="currentColor" stroke-width="1.5" />
              </svg>
            </div>
            <h2>{{ $t('setup.nameYourWorkspace') }}</h2>
            <p class="step-description">
              Choose a name that represents your private workspace. You can change this later.
            </p>

            <div class="form-field">
              <label for="siteName">{{ $t('setup.siteName') }}</label>
              <input
                id="siteName"
                v-model="siteName"
                type="text"
                placeholder="我的工作区"
                maxlength="255"
                autofocus
              />
              <span class="field-hint">{{ $t('setup.siteNameHelp') }}</span>
            </div>
          </div>

          <!-- Step 3: Success -->
          <div v-else-if="currentStep === 3" key="step3" class="step-panel success-panel">
            <div class="success-animation">
              <div class="success-circle">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path
                    class="check-path"
                    d="M12 24L20 32L36 16"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              <div class="success-rings">
                <div class="ring ring-1"></div>
                <div class="ring ring-2"></div>
                <div class="ring ring-3"></div>
              </div>
            </div>
            <h2>{{ $t('setup.allSet') }}</h2>
            <p class="step-description">
              Your private workspace <strong>{{ siteName }}</strong> is ready. Sign in to continue.
            </p>

            <div class="success-summary">
              <div class="summary-item">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="7" r="3" stroke="currentColor" stroke-width="1.5" />
                  <path
                    d="M3 16C3 13.2386 5.68629 11 9 11C12.3137 11 15 13.2386 15 16"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
                <span>登录邮箱：{{ adminEmail }}</span>
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Navigation Buttons -->
      <div class="step-navigation">
        <button v-if="currentStep > 1 && currentStep < 3" class="btn-secondary" @click="prevStep">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 12L6 8L10 4"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          {{ $t('common.back') }}
        </button>
        <div v-else class="spacer"></div>

        <button
          v-if="currentStep < 2"
          class="btn-primary"
          :disabled="!canProceed"
          @click="nextStep"
        >
          {{ $t('common.continue') }}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 4L10 8L6 12"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <button
          v-else-if="currentStep === 2"
          class="btn-primary"
          :disabled="!canProceed || loading"
          @click="completeSetup"
        >
          <span v-if="loading" class="loading-spinner"></span>
          <template v-else>
            {{ $t('setup.completeSetup') }}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8L6 11L13 4"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </template>
        </button>

        <button v-else-if="currentStep === 3" class="btn-primary btn-large" @click="goToLogin">
          Sign In to Your Workspace
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M6.75 4.5L11.25 9L6.75 13.5"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Footer -->
    <div class="setup-footer">
      <p>
        Developed by
        <a href="https://www.akaalcreatives.com" target="_blank" rel="noopener">Akaal Creatives</a>
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Base Layout */
.setup-page {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--space-6);
  overflow: hidden;
  background: var(--color-background);
}

/* Background Decorations */
.bg-decoration {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.leaf {
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
  opacity: 0.04;
  background: var(--color-accent);
}

.leaf-1 {
  top: -100px;
  right: -50px;
  animation: float 20s ease-in-out infinite;
}

.leaf-2 {
  bottom: -80px;
  left: -100px;
  width: 400px;
  height: 400px;
  animation: float 25s ease-in-out infinite reverse;
}

.leaf-3 {
  top: 40%;
  right: 10%;
  width: 200px;
  height: 200px;
  animation: float 18s ease-in-out infinite 5s;
}

.glow {
  position: absolute;
  top: 20%;
  left: 30%;
  width: 500px;
  height: 500px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--color-accent-subtle) 0%, transparent 70%);
  opacity: 0.5;
}

@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) rotate(0deg);
  }
  25% {
    transform: translate(10px, -15px) rotate(5deg);
  }
  50% {
    transform: translate(-5px, 10px) rotate(-3deg);
  }
  75% {
    transform: translate(15px, 5px) rotate(2deg);
  }
}

/* Theme Toggle */
.theme-toggle {
  position: fixed;
  top: var(--space-5);
  right: var(--space-5);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  color: var(--color-text-secondary);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.theme-toggle:hover {
  color: var(--color-text-primary);
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

/* Main Container */
.setup-container {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 520px;
}

/* Header */
.setup-header {
  margin-bottom: var(--space-8);
  text-align: center;
}

.logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  margin-bottom: var(--space-5);
  background: var(--color-accent-subtle);
  border-radius: var(--radius-2xl);
  animation: pulse-glow 3s ease-in-out infinite;
}

.logo-icon {
  color: var(--color-accent);
}

@keyframes pulse-glow {
  0%,
  100% {
    box-shadow: 0 0 0 0 var(--color-accent-subtle);
  }
  50% {
    box-shadow: 0 0 0 12px transparent;
  }
}

.title {
  margin-bottom: var(--space-2);
  font-size: var(--text-3xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-text-primary);
}

.subtitle {
  font-size: var(--text-base);
  color: var(--color-text-secondary);
}

/* Progress Indicator */
.progress-container {
  width: 100%;
  margin-bottom: var(--space-8);
}

.progress-bar {
  height: 4px;
  margin-bottom: var(--space-4);
  overflow: hidden;
  background: var(--color-border);
  border-radius: var(--radius-full);
}

.progress-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: var(--radius-full);
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.progress-steps {
  display: flex;
  justify-content: space-between;
}

.progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.step-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-tertiary);
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-full);
  transition: all var(--transition-base);
}

.progress-step.active .step-dot {
  color: var(--color-text-inverse);
  background: var(--color-accent);
  border-color: var(--color-accent);
  transform: scale(1.1);
  box-shadow: 0 0 0 4px var(--color-accent-subtle);
}

.progress-step.completed .step-dot {
  color: var(--color-text-inverse);
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.step-label {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-text-tertiary);
  transition: color var(--transition-fast);
}

.progress-step.active .step-label,
.progress-step.completed .step-label {
  color: var(--color-text-secondary);
}

/* Error Banner */
.error-banner {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  width: 100%;
  padding: var(--space-4);
  margin-bottom: var(--space-6);
  font-size: var(--text-sm);
  color: var(--color-error);
  background: var(--color-error-subtle);
  border-radius: var(--radius-lg);
}

/* Step Content */
.step-content {
  width: 100%;
  min-height: 380px;
}

.step-panel {
  display: flex;
  flex-direction: column;
  padding: var(--space-8);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-lg);
}

.step-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  margin-bottom: var(--space-5);
  color: var(--color-accent);
  background: var(--color-accent-subtle);
  border-radius: var(--radius-xl);
}

.step-panel h2 {
  margin-bottom: var(--space-2);
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--color-text-primary);
}

.step-description {
  margin-bottom: var(--space-6);
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--color-text-secondary);
}

/* Form Fields */
.form-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-field label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-primary);
}

.form-field label .optional {
  font-weight: 400;
  color: var(--color-text-tertiary);
}

.form-field input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-family: inherit;
  font-size: var(--text-base);
  color: var(--color-text-primary);
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-lg);
  outline: none;
  transition: all var(--transition-fast);
}

.form-field input::placeholder {
  color: var(--color-text-tertiary);
}

.form-field input:focus {
  border-color: var(--input-focus-border);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

.field-hint {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.field-error {
  font-size: var(--text-xs);
  color: var(--color-error);
}

/* Slug Input */
.slug-input-wrapper {
  display: flex;
  align-items: center;
  overflow: hidden;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.slug-input-wrapper:focus-within {
  border-color: var(--input-focus-border);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

.slug-prefix {
  padding: var(--space-3) 0 var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
  white-space: nowrap;
  background: var(--color-surface-sunken);
}

.slug-input-wrapper input {
  flex: 1;
  padding-left: var(--space-2);
  border: none;
  border-radius: 0;
  box-shadow: none;
}

.slug-input-wrapper input:focus {
  box-shadow: none;
}

/* Password Strength */
.password-strength {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.strength-bar {
  flex: 1;
  height: 4px;
  overflow: hidden;
  background: var(--color-border);
  border-radius: var(--radius-full);
}

.strength-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: all var(--transition-base);
}

.strength-fill.level-1 {
  width: 20%;
  background: var(--color-error);
}
.strength-fill.level-2 {
  width: 40%;
  background: var(--color-error);
}
.strength-fill.level-3 {
  width: 60%;
  background: var(--color-warning);
}
.strength-fill.level-4 {
  width: 80%;
  background: var(--color-success);
}
.strength-fill.level-5 {
  width: 100%;
  background: var(--color-success);
}

.strength-label {
  font-size: var(--text-xs);
  font-weight: 500;
}

.strength-label.level-1,
.strength-label.level-2 {
  color: var(--color-error);
}
.strength-label.level-3 {
  color: var(--color-warning);
}
.strength-label.level-4,
.strength-label.level-5 {
  color: var(--color-success);
}

/* Success Panel */
.success-panel {
  align-items: center;
  text-align: center;
}

.success-animation {
  position: relative;
  width: 100px;
  height: 100px;
  margin-bottom: var(--space-6);
}

.success-circle {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-inverse);
  background: var(--color-accent);
  border-radius: 50%;
  animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.check-path {
  stroke-dasharray: 50;
  stroke-dashoffset: 50;
  animation: draw-check 0.4s ease-out 0.3s forwards;
}

@keyframes pop-in {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes draw-check {
  to {
    stroke-dashoffset: 0;
  }
}

.success-rings {
  position: absolute;
  inset: 0;
}

.ring {
  position: absolute;
  inset: 0;
  border: 2px solid var(--color-accent);
  border-radius: 50%;
  opacity: 0;
}

.ring-1 {
  animation: ring-expand 1s ease-out 0.2s;
}
.ring-2 {
  animation: ring-expand 1s ease-out 0.4s;
}
.ring-3 {
  animation: ring-expand 1s ease-out 0.6s;
}

@keyframes ring-expand {
  0% {
    transform: scale(1);
    opacity: 0.6;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

.success-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  margin-top: var(--space-4);
  background: var(--color-surface-sunken);
  border-radius: var(--radius-lg);
}

.summary-item {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.summary-item svg {
  color: var(--color-accent);
}

/* Navigation */
.step-navigation {
  display: flex;
  justify-content: space-between;
  width: 100%;
  margin-top: var(--space-6);
}

.spacer {
  flex: 1;
}

.btn-primary,
.btn-secondary {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: center;
  height: 48px;
  padding: 0 var(--space-6);
  font-family: inherit;
  font-size: var(--text-base);
  font-weight: 600;
  border: none;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary {
  color: var(--color-text-inverse);
  background: var(--color-accent);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-primary:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.btn-primary.btn-large {
  height: 56px;
  padding: 0 var(--space-8);
  font-size: var(--text-lg);
}

.btn-secondary {
  color: var(--color-text-secondary);
  background: transparent;
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  color: var(--color-text-primary);
  background: var(--color-hover);
  border-color: var(--color-border-strong);
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-text-inverse);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Footer */
.setup-footer {
  position: absolute;
  bottom: var(--space-6);
  left: 50%;
  transform: translateX(-50%);
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.setup-footer a {
  color: var(--color-accent);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.setup-footer a:hover {
  color: var(--color-accent-hover);
}

/* Transitions */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 600px) {
  .setup-page {
    padding: var(--space-4);
  }

  .step-panel {
    padding: var(--space-6);
  }

  .title {
    font-size: var(--text-2xl);
  }

  .step-label {
    display: none;
  }

  .btn-primary.btn-large {
    width: 100%;
  }
}
</style>
