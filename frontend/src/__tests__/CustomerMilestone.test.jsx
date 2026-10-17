import { describe, it, expect } from 'vitest';

describe('Customer Milestone Progress Calculation Tests', () => {
  const calculateMilestoneProgress = (completedBookingsCount, userTotalTrips = 0) => {
    const totalTrips = Math.max(completedBookingsCount, userTotalTrips);
    const target = 10;
    const progressPercent = Math.min(100, Math.max(0, (totalTrips / target) * 100));
    const remaining = Math.max(0, target - totalTrips);
    const isCompleted = totalTrips >= target;
    return {
      totalTrips,
      progressPercent,
      remaining,
      isCompleted,
      rideText: `${totalTrips} ${totalTrips === 1 ? 'Ride' : 'Rides'}`,
      remainingText: isCompleted ? '🎉 Milestone Achieved! ₹500 Wallet Cash Credited' : `${remaining} ${remaining === 1 ? 'ride' : 'rides'} remaining!`
    };
  };

  it('TC-MLS-001: should accurately compute milestone progress for 1 completed ride (user screenshot scenario)', () => {
    // In screenshot: 1 completed ride, user.totalTrips was 0
    const progress = calculateMilestoneProgress(1, 0);
    expect(progress.totalTrips).toBe(1);
    expect(progress.rideText).toBe('1 Ride');
    expect(progress.progressPercent).toBe(10);
    expect(progress.remaining).toBe(9);
    expect(progress.remainingText).toBe('9 rides remaining!');
    expect(progress.isCompleted).toBe(false);
  });

  it('TC-MLS-002: should handle zero completed rides', () => {
    const progress = calculateMilestoneProgress(0, 0);
    expect(progress.totalTrips).toBe(0);
    expect(progress.rideText).toBe('0 Rides');
    expect(progress.progressPercent).toBe(0);
    expect(progress.remaining).toBe(10);
    expect(progress.remainingText).toBe('10 rides remaining!');
    expect(progress.isCompleted).toBe(false);
  });

  it('TC-MLS-003: should handle 10 or more completed rides', () => {
    const progress = calculateMilestoneProgress(10, 0);
    expect(progress.totalTrips).toBe(10);
    expect(progress.rideText).toBe('10 Rides');
    expect(progress.progressPercent).toBe(100);
    expect(progress.remaining).toBe(0);
    expect(progress.remainingText).toContain('Milestone Achieved');
    expect(progress.isCompleted).toBe(true);
  });

  it('TC-MLS-004: should reflect higher count if user.totalTrips is greater', () => {
    const progress = calculateMilestoneProgress(2, 5);
    expect(progress.totalTrips).toBe(5);
    expect(progress.rideText).toBe('5 Rides');
    expect(progress.progressPercent).toBe(50);
    expect(progress.remaining).toBe(5);
  });
});
