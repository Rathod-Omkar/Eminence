import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SettingsTab from '../components/admin/SettingsTab';
import { adminApi } from '../services/adminApi';

vi.mock('../services/adminApi', () => ({
  adminApi: {
    getAdmins: vi.fn(),
    deleteAdmin: vi.fn(),
    bulkDeleteAdmins: vi.fn(),
    createAdmin: vi.fn(),
    updateAdmin: vi.fn(),
  }
}));

const createMockStore = (currentUser) => {
  return configureStore({
    reducer: {
      auth: (state = { user: currentUser }) => state,
    }
  });
};

describe('Admin Settings & Super Admin Protection Tests', () => {
  const sampleAdmins = [
    {
      id: 'admin-root-1',
      name: 'Super Admin',
      email: 'admin@eminence.com',
      role: 'Superadmin',
      isPrimary: true,
      createdAt: '2026-10-17T00:00:00.000Z'
    },
    {
      id: 'admin-john-2',
      name: 'john',
      email: 'john123@gmail.com',
      role: 'Support Admin',
      isPrimary: false,
      createdAt: '2026-10-17T12:00:00.000Z'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-ADM-001: Disables delete button and checkbox for primary Super Admin when viewed by newly created admin', async () => {
    adminApi.getAdmins.mockResolvedValueOnce({
      data: { success: true, admins: sampleAdmins }
    });

    // John logged in as newly created Support Admin
    const store = createMockStore({
      id: 'admin-john-2',
      name: 'john',
      email: 'john123@gmail.com',
      adminRole: 'Support Admin',
      isPrimary: false
    });

    render(
      <Provider store={store}>
        <SettingsTab />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('john')).toBeDefined();
      expect(screen.getByText('Super Admin')).toBeDefined();
    });

    // Check ROOT badge on primary superadmin
    expect(screen.getByText('ROOT')).toBeDefined();

    // Check that Super Admin delete button is disabled
    const superAdminRow = screen.getByText('admin@eminence.com').closest('tr');
    const deleteBtn = superAdminRow.querySelector('button[title="The primary Super Administrator cannot be deleted"]');
    expect(deleteBtn).toBeDefined();
    expect(deleteBtn.disabled).toBe(true);

    // Check that Super Admin checkbox is disabled
    const checkbox = superAdminRow.querySelector('input[type="checkbox"]');
    expect(checkbox.disabled).toBe(true);
  });

  it('TC-ADM-002: Prevents calling deleteAdmin API when attempting to delete the primary Super Admin', async () => {
    adminApi.getAdmins.mockResolvedValueOnce({
      data: { success: true, admins: sampleAdmins }
    });

    const store = createMockStore({
      id: 'admin-john-2',
      name: 'john',
      email: 'john123@gmail.com',
      adminRole: 'Support Admin',
      isPrimary: false
    });

    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(
      <Provider store={store}>
        <SettingsTab />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('admin@eminence.com')).toBeDefined();
    });

    const superAdminRow = screen.getByText('admin@eminence.com').closest('tr');
    const deleteBtn = superAdminRow.querySelector('button[title="The primary Super Administrator cannot be deleted"]');
    
    // Simulate click
    fireEvent.click(deleteBtn);

    expect(adminApi.deleteAdmin).not.toHaveBeenCalled();
    alertMock.mockRestore();
  });

  it('TC-ADM-003: Allows primary Super Admin to manage other non-primary administrators', async () => {
    adminApi.getAdmins.mockResolvedValueOnce({
      data: { success: true, admins: sampleAdmins }
    });

    // Primary Super Admin logged in
    const store = createMockStore({
      id: 'admin-root-1',
      name: 'Super Admin',
      email: 'admin@eminence.com',
      adminRole: 'Superadmin',
      isPrimary: true
    });

    render(
      <Provider store={store}>
        <SettingsTab />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('john123@gmail.com')).toBeDefined();
    });

    const johnRow = screen.getByText('john123@gmail.com').closest('tr');
    const johnDeleteBtn = johnRow.querySelector('button[title="Delete Admin"]');
    expect(johnDeleteBtn).toBeDefined();
    expect(johnDeleteBtn.disabled).toBe(false);

    const johnCheckbox = johnRow.querySelector('input[type="checkbox"]');
    expect(johnCheckbox.disabled).toBe(false);
  });
});
