import { describe, it, expect } from 'vitest';
import { getPunePincode, PUNE_LOCALITY_PINCODES } from '../utils/puneGeocoder';
import { addressSchema } from '../utils/formSchemas';

describe('Postal Code Auto-Update & Geocoder Resolution Tests', () => {
  it('TC-PIN-001: should accurately auto-resolve postal code for user screenshot location (Kothrud Depot)', () => {
    const rawQuery = 'Kothrud Depot, Paud Road, Kothrud, Bav';
    const postalCode = getPunePincode(rawQuery);
    expect(postalCode).toBe('411038');
  });

  it('TC-PIN-002: should resolve postal codes for key Pune & PCMC hubs', () => {
    expect(getPunePincode('Hinjewadi Phase 2, Rajiv Gandhi Infotech Park')).toBe('411057');
    expect(getPunePincode('Balewadi High Street, Baner')).toBe('411045');
    expect(getPunePincode('Viman Nagar, near Pune Airport')).toBe('411014');
    expect(getPunePincode('EON Free Zone, Kharadi')).toBe('411014');
    expect(getPunePincode('BJS School, Bakori Road, Wagholi')).toBe('412207');
    expect(getPunePincode('Nyati Estate, Mohammadwadi, DPS Pune')).toBe('411048');
    expect(getPunePincode('Bhosari MIDC Industrial Area')).toBe('411026');
    expect(getPunePincode('Chinchwad Station, PCMC')).toBe('411033');
    expect(getPunePincode('Aundh, Parihar Chowk')).toBe('411007');
    expect(getPunePincode('Bavdhan Khurd, Pune')).toBe('411021');
    expect(getPunePincode('Warje Malwadi, Mai Mangeshkar Hospital')).toBe('411058');
    expect(getPunePincode('Swargate Bus Terminal')).toBe('411042');
    expect(getPunePincode('MG Road, Pune Camp')).toBe('411001');
  });

  it('TC-PIN-003: should prioritize explicit 6-digit pin in text if present', () => {
    const withPin = 'Flat 204, Rose Villa, Model Colony, Pune 411016';
    expect(getPunePincode(withPin)).toBe('411016');
  });

  it('TC-PIN-004: should extract postal code from Nominatim raw address object', () => {
    const mockNominatim = {
      display_name: 'Custom Society, Pune',
      raw: {
        address: {
          suburb: 'Kothrud',
          city: 'Pune',
          postcode: '411038'
        }
      }
    };
    expect(getPunePincode('Custom Society', mockNominatim)).toBe('411038');
  });

  it('TC-PIN-005: should validate address with auto-detected postal code', () => {
    const street = 'Kothrud Depot, Paud Road, Kothrud, Bav';
    const autoPostal = getPunePincode(street);
    const newAddress = {
      label: 'Home',
      street,
      city: 'Pune',
      postalCode: autoPostal
    };
    const validation = addressSchema.safeParse(newAddress);
    expect(validation.success).toBe(true);
    if (validation.success) {
      expect(validation.data.postalCode).toBe('411038');
    }
  });
});
