import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import CustomerDashboard from '../pages/CustomerDashboard';
import authReducer from '../redux/slices/authSlice';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStore = configureStore({
  reducer: { auth: authReducer },
  preloadedState: {
    auth: {
      user: { id: 'cust-123', name: 'John Doe', role: 'customer', email: 'john@example.com' },
      token: 'mock-token',
      isAuthenticated: true
    }
  }
});

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/api/wallet') {
        return Promise.resolve({
          data: {
            wallet: { balance: 500.0, transactions: [] },
            referralCode: 'EMN-DEMO-2026'
          }
        });
      }
      if (url === '/api/bookings') {
        return Promise.resolve({ data: { bookings: [] } });
      }
      if (url === '/api/notifications') {
        return Promise.resolve({ data: { notifications: [], unreadCount: 0 } });
      }
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn().mockResolvedValue({ data: { success: true } })
  }
}));

describe('Wallet and Refill Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-WLT-001: CustomerDashboard resolves to payments tab and shows Add Funds when autoOpenTopup is true', async () => {
    render(
      <Provider store={mockStore}>
        <MemoryRouter initialEntries={['/wallet']}>
          <CustomerDashboard initialTab="payments" autoOpenTopup={true} />
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Available Wallet Balance/i)).toBeInTheDocument();
      expect(screen.getByText(/Add Funds to Wallet/i)).toBeInTheDocument();
      expect(screen.getByText(/Instant recharge via Razorpay/i)).toBeInTheDocument();
    });
  });

  it('TC-WLT-002: CustomerDashboard recognizes ?tab=payments query param', async () => {
    render(
      <Provider store={mockStore}>
        <MemoryRouter initialEntries={['/customer/dashboard?tab=payments']}>
          <CustomerDashboard />
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Available Wallet Balance/i)).toBeInTheDocument();
    });
  });
});
