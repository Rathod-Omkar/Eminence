import { describe, it, expect } from 'vitest';
import { bookingDetailsSchema, VEHICLE_CAPACITIES } from '../utils/formSchemas';

describe('Vehicle Capacity & Booking Weight Validation Tests', () => {
  it('TC-CAP-001: should define accurate platform vehicle capacities', () => {
    expect(VEHICLE_CAPACITIES.small).toBe(750);
    expect(VEHICLE_CAPACITIES.medium).toBe(1500);
    expect(VEHICLE_CAPACITIES.large).toBe(5000);
  });

  it('TC-CAP-002: should accept weight 3009kg on large vehicle (within 5000kg capacity)', () => {
    const data = {
      goodsType: 'Machinery Boxes',
      weight: 3009,
      tempoType: 'large',
      totalDistance: 15
    };
    const res = bookingDetailsSchema.safeParse(data);
    expect(res.success).toBe(true);
  });

  it('TC-CAP-003: should accept full 5000kg on large vehicle', () => {
    const data = {
      goodsType: 'Heavy Metal Sheets',
      weight: 5000,
      tempoType: 'large',
      totalDistance: 20
    };
    const res = bookingDetailsSchema.safeParse(data);
    expect(res.success).toBe(true);
  });

  it('TC-CAP-004: should reject weight exceeding 5000kg on large vehicle with exact message', () => {
    const data = {
      goodsType: 'Industrial Heavy Equipment',
      weight: 10000,
      tempoType: 'large',
      totalDistance: 20
    };
    const res = bookingDetailsSchema.safeParse(data);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toBe(
        'Cargo weight (10000kg) exceeds maximum capacity for large vehicle (5000kg)'
      );
    }
  });

  it('TC-CAP-005: should enforce small vehicle capacity (750kg)', () => {
    const validSmall = {
      goodsType: 'Parcels',
      weight: 750,
      tempoType: 'small',
      totalDistance: 10
    };
    expect(bookingDetailsSchema.safeParse(validSmall).success).toBe(true);

    const invalidSmall = {
      goodsType: 'Parcels',
      weight: 751,
      tempoType: 'small',
      totalDistance: 10
    };
    const res = bookingDetailsSchema.safeParse(invalidSmall);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toBe(
        'Cargo weight (751kg) exceeds maximum capacity for small vehicle (750kg)'
      );
    }
  });

  it('TC-CAP-006: should enforce medium vehicle capacity (1500kg)', () => {
    const validMedium = {
      goodsType: 'Furniture',
      weight: 1500,
      tempoType: 'medium',
      totalDistance: 12
    };
    expect(bookingDetailsSchema.safeParse(validMedium).success).toBe(true);

    const invalidMedium = {
      goodsType: 'Furniture',
      weight: 1501,
      tempoType: 'medium',
      totalDistance: 12
    };
    const res = bookingDetailsSchema.safeParse(invalidMedium);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toBe(
        'Cargo weight (1501kg) exceeds maximum capacity for medium vehicle (1500kg)'
      );
    }
  });
});
