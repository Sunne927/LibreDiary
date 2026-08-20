import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const mockRouter = vi.hoisted(() => ({ push: vi.fn() }));
const { mockSetupService, mockResetSetupStatus, mockTheme } = vi.hoisted(() => ({
  mockSetupService: { complete: vi.fn() },
  mockResetSetupStatus: vi.fn(),
  mockTheme: { theme: 'light', toggleTheme: vi.fn() },
}));

vi.mock('vue-router', () => ({ useRouter: () => mockRouter }));
vi.mock('@/composables', () => ({ useTheme: () => mockTheme }));
vi.mock('@/services', () => ({
  setupService: mockSetupService,
  ApiError: class ApiError extends Error {
    code: string;
    constructor(message: string, code = 'UNKNOWN') {
      super(message);
      this.code = code;
    }
  },
}));
vi.mock('@/router', () => ({ resetSetupStatus: mockResetSetupStatus }));

import SetupWizardPage from '../SetupWizardPage.vue';
import { ApiError } from '@/services';

function mountPage() {
  return mount(SetupWizardPage, {
    global: { stubs: { Teleport: true, Transition: true } },
  });
}

async function fillAccessStep(wrapper: ReturnType<typeof mountPage>) {
  await wrapper.find('#adminEmail').setValue('owner@example.com');
  await wrapper.find('#adminPassword').setValue('password123');
  await wrapper.find('#adminPasswordConfirm').setValue('password123');
}

describe('SetupWizardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetupService.complete.mockReset();
  });

  it('starts with access credentials, not an organisation form', () => {
    const wrapper = mountPage();

    expect(wrapper.find('h2').text()).toContain('设置访问密码');
    expect(wrapper.find('#adminEmail').exists()).toBe(true);
    expect(wrapper.find('#adminPassword').exists()).toBe(true);
    expect(wrapper.find('#orgName').exists()).toBe(false);
    expect(wrapper.findAll('.step-label').map((step) => step.text())).toEqual(['访问凭证', 'Site']);
  });

  it('requires a valid password before continuing', async () => {
    const wrapper = mountPage();
    expect(wrapper.find('.btn-primary').attributes('disabled')).toBeDefined();

    await fillAccessStep(wrapper);
    expect(wrapper.find('.btn-primary').attributes('disabled')).toBeUndefined();
    await wrapper.find('.btn-primary').trigger('click');
    expect(wrapper.find('#siteName').exists()).toBe(true);
  });

  it('completes setup with a generated personal workspace', async () => {
    mockSetupService.complete.mockResolvedValue({
      user: { id: 'u1', email: 'owner@example.com', name: null, isSuperAdmin: true },
      organization: { id: 'o1', name: 'My Space', slug: 'my-space' },
    });

    const wrapper = mountPage();
    await fillAccessStep(wrapper);
    await wrapper.find('.btn-primary').trigger('click');
    await wrapper.find('#siteName').setValue('My Space');
    await wrapper.find('.btn-primary').trigger('click');
    await flushPromises();

    expect(mockSetupService.complete).toHaveBeenCalledWith({
      siteName: 'My Space',
      admin: {
        email: 'owner@example.com',
        password: 'password123',
        name: undefined,
      },
      organization: { name: 'My Space', slug: 'my-space' },
    });
    expect(wrapper.text()).toContain('Your private workspace');
    expect(wrapper.text()).not.toContain('Organisation');
  });

  it('shows setup errors and can continue to login after success', async () => {
    mockSetupService.complete.mockRejectedValueOnce(new ApiError('Setup failed', 'SETUP_ERROR'));
    const wrapper = mountPage();
    await fillAccessStep(wrapper);
    await wrapper.find('.btn-primary').trigger('click');
    await wrapper.find('.btn-primary').trigger('click');
    await flushPromises();
    expect(wrapper.find('.error-banner').text()).toContain('Setup failed');

    mockSetupService.complete.mockResolvedValueOnce({
      user: { id: 'u1', email: 'owner@example.com', name: null, isSuperAdmin: true },
      organization: { id: 'o1', name: 'LibreDiary', slug: 'librediary' },
    });
    await wrapper.find('.btn-primary').trigger('click');
    await flushPromises();
    expect(mockResetSetupStatus).toHaveBeenCalled();
    await wrapper.find('.btn-primary').trigger('click');
    expect(mockRouter.push).toHaveBeenCalledWith('/login');
  });

  it('renders developer attribution in footer', () => {
    expect(mountPage().find('.setup-footer').text()).toContain('Akaal Creatives');
  });
});
