import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../services/api';

interface BookingItem {
  id: string;
  status: string;
  pickupAddress: string;
  dropAddress: string;
  tempoType: string;
  goodsType: string;
  estimatedFare: number;
  driverId?: string | null;
  queuePosition?: number;
  driver?: {
    id: string;
    name: string;
    phone: string;
  };
  customer?: {
    name: string;
    phone: string;
  };
  createdAt?: string;
}

interface DriverItem {
  id: string;
  name: string;
  phone: string;
  licenseNumber: string;
  status: string;
}

export default function DispatchScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  // Assignment Modal
  const [selectedBooking, setSelectedBooking] = useState<BookingItem | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const fetchData = async () => {
    try {
      const [bookingsRes, driversRes] = await Promise.allSettled([
        api.get('/api/bookings'),
        api.get('/api/admin/drivers'),
      ]);

      if (bookingsRes.status === 'fulfilled' && bookingsRes.value.data?.bookings) {
        setBookings(bookingsRes.value.data.bookings);
      }

      if (driversRes.status === 'fulfilled' && driversRes.value.data?.drivers) {
        setDrivers(driversRes.value.data.drivers);
      }
    } catch (err) {
      console.error('Error fetching dispatch data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleOpenAssignModal = (b: BookingItem) => {
    setSelectedBooking(b);
    setAssignModalOpen(true);
  };

  const handleAssignDriver = async (driverId: string) => {
    if (!selectedBooking) return;
    setAssigning(true);

    try {
      await api.put(`/api/bookings/${selectedBooking.id}/status`, {
        status: 'driver_assigned',
        driverId,
      });

      Alert.alert('Trip Appointed', 'The driver has been successfully assigned to this booking.');
      setAssignModalOpen(false);
      setSelectedBooking(null);
      fetchData();
    } catch (err: any) {
      console.error('Error appointing driver:', err);
      Alert.alert('Assignment Failed', err.response?.data?.message || 'Could not appoint trip to driver');
    } finally {
      setAssigning(false);
    }
  };

  const activeDrivers = drivers.filter((d) => d.status === 'active');
  const pendingBookings = bookings.filter((b) => b.status === 'pending' || !b.driverId);
  const displayedBookings = filter === 'pending' ? pendingBookings : bookings;

  const driverQueueMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    bookings.forEach((b) => {
      if (b.driverId && !['completed', 'cancelled'].includes(b.status)) {
        map[b.driverId] = (map[b.driverId] || 0) + 1;
      }
    });
    return map;
  }, [bookings]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appoint Work</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* 8 Tempos Limited Fleet Status Card */}
      <View style={styles.fleetBanner}>
        <View style={styles.fleetBannerHeader}>
          <Text style={styles.fleetBannerTitle}>Company Fleet (8 Limited Tempos)</Text>
          <View style={styles.fleetQueueActiveBadge}>
            <Text style={styles.fleetQueueActiveText}>Queue Engine Active</Text>
          </View>
        </View>
        <Text style={styles.fleetBannerModels}>
          • 1x Bolero Pickup (Diesel)  • 1x Dost (Diesel){'\n'}• 4x Tata Ace (1 Petrol, 3 CNG)  • 2x Chotta Hatti (Diesel)
        </Text>
      </View>

      {/* KPI Stats */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Pending Trips</Text>
          <Text style={[styles.kpiValue, { color: '#f59e0b' }]}>{pendingBookings.length}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Active Drivers</Text>
          <Text style={[styles.kpiValue, { color: '#10b981' }]}>
            {activeDrivers.length} <Text style={styles.kpiTotal}>/ {drivers.length}</Text>
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, filter === 'pending' && styles.tabActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.tabText, filter === 'pending' && styles.tabTextActive]}>
            Pending Dispatch ({pendingBookings.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, filter === 'all' && styles.tabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.tabText, filter === 'all' && styles.tabTextActive]}>
            All Trips ({bookings.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#6366f1" style={{ marginVertical: 40 }} />
        ) : displayedBookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>✓</Text>
            <Text style={styles.emptyTitle}>
              {filter === 'pending' ? 'All Bookings Appointed!' : 'No Bookings Found'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'pending'
                ? 'No pending trips requiring driver appointment right now.'
                : 'Customer ride bookings will appear here.'}
            </Text>
          </View>
        ) : (
          displayedBookings.map((b) => {
            const isPending = b.status === 'pending' || !b.driverId;
            const currentDriver = b.driver || drivers.find((d) => d.id === b.driverId);

            return (
              <View key={b.id} style={styles.bookingCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.bookingId}>#{b.id.slice(0, 8)}</Text>
                    {b.driverId && (
                      <View
                        style={[
                          styles.queuePosBadge,
                          b.queuePosition === 1 || !b.queuePosition
                            ? styles.queuePosActive
                            : styles.queuePosQueued,
                        ]}
                      >
                        <Text
                          style={[
                            styles.queuePosText,
                            b.queuePosition === 1 || !b.queuePosition
                              ? styles.queuePosActiveText
                              : styles.queuePosQueuedText,
                          ]}
                        >
                          {b.queuePosition === 1 || !b.queuePosition
                            ? '🎯 Active Delivery'
                            : `⏳ Stop #${b.queuePosition} (Queue)`}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      isPending ? styles.statusPillPending : styles.statusPillAssigned,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        isPending ? { color: '#f59e0b' } : { color: '#38bdf8' },
                      ]}
                    >
                      {b.status ? b.status.replace('_', ' ').toUpperCase() : 'PENDING'}
                    </Text>
                  </View>
                </View>

                {/* Route */}
                <View style={styles.routeContainer}>
                  <View style={styles.routeRow}>
                    <Text style={styles.routeDotGreen}>●</Text>
                    <Text style={styles.routeText} numberOfLines={1}>
                      {b.pickupAddress}
                    </Text>
                  </View>
                  <View style={styles.routeRow}>
                    <Text style={styles.routeDotOrange}>▼</Text>
                    <Text style={[styles.routeText, { color: '#f08b65' }]} numberOfLines={1}>
                      {b.dropAddress || 'Multi-stop delivery'}
                    </Text>
                  </View>
                </View>

                {/* Details */}
                <View style={styles.detailsRow}>
                  <Text style={styles.detailText}>
                    {b.tempoType ? b.tempoType.toUpperCase() : 'STANDARD'} • {b.goodsType || 'Goods'}
                  </Text>
                  <Text style={styles.fareText}>₹{b.estimatedFare || 0}</Text>
                </View>

                {/* Driver Info / Action */}
                <View style={styles.cardFooter}>
                  {currentDriver ? (
                    <View style={styles.driverAssignedInfo}>
                      <Text style={styles.driverLabel}>Assigned Driver:</Text>
                      <Text style={styles.driverName}>
                        {currentDriver.name} ({currentDriver.phone})
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.unassignedText}>No driver appointed yet</Text>
                  )}

                  <TouchableOpacity
                    style={[styles.appointBtn, !isPending && styles.reappointBtn]}
                    onPress={() => handleOpenAssignModal(b)}
                  >
                    <Text style={styles.appointBtnText}>
                      {isPending ? 'Appoint Driver' : 'Reassign'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Driver Assignment Modal */}
      <Modal
        visible={assignModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAssignModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Appoint Driver</Text>
              <TouchableOpacity onPress={() => setAssignModalOpen(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedBooking && (
              <View style={styles.modalBookingSummary}>
                <Text style={styles.modalSummaryText}>
                  Booking #{selectedBooking.id.slice(0, 8)} • ₹{selectedBooking.estimatedFare}
                </Text>
                <Text style={styles.modalSummaryRoute} numberOfLines={1}>
                  {selectedBooking.pickupAddress} → {selectedBooking.dropAddress}
                </Text>
              </View>
            )}

            <Text style={styles.modalSubheading}>Select from Active Fleet Drivers:</Text>

            {assigning ? (
              <ActivityIndicator size="large" color="#6366f1" style={{ marginVertical: 30 }} />
            ) : activeDrivers.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text style={{ color: '#a2b2c7', fontSize: 13 }}>
                  No active drivers currently available on duty.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 280 }}>
                {activeDrivers.map((drv) => {
                  const queuedCount = driverQueueMap[drv.id] || 0;
                  return (
                    <TouchableOpacity
                      key={drv.id}
                      style={styles.driverSelectCard}
                      onPress={() => handleAssignDriver(drv.id)}
                    >
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={styles.driverSelectName}>{drv.name}</Text>
                          <View
                            style={[
                              styles.drvQueueBadge,
                              queuedCount === 0
                                ? styles.drvQueueAvailable
                                : queuedCount === 1
                                ? styles.drvQueueSingle
                                : styles.drvQueueMultiple,
                            ]}
                          >
                            <Text
                              style={[
                                styles.drvQueueText,
                                queuedCount === 0
                                  ? styles.drvQueueAvailableText
                                  : queuedCount === 1
                                  ? styles.drvQueueSingleText
                                  : styles.drvQueueMultipleText,
                              ]}
                            >
                              {queuedCount === 0
                                ? '🟢 Available (0 in Queue)'
                                : queuedCount === 1
                                ? '🟡 1 in Queue'
                                : `🟠 ${queuedCount} in Queue`}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.driverSelectPhone}>{drv.phone}</Text>
                        <Text style={styles.driverSelectLicense}>
                          License: {drv.licenseNumber}
                          {queuedCount > 0 ? ' • Next in sequence' : ' • Immediate dispatch'}
                        </Text>
                      </View>
                      <Text style={styles.selectArrow}>Assign ›</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setAssignModalOpen(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f141f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 16,
    backgroundColor: '#1b2230',
    borderBottomWidth: 1,
    borderBottomColor: '#2f3a4e',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#293243',
  },
  backBtnText: {
    color: '#c9d3df',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#f4f6f8',
    fontSize: 18,
    fontWeight: '700',
  },
  refreshBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#293243',
  },
  refreshBtnText: {
    color: '#c9d3df',
    fontSize: 16,
    fontWeight: '700',
  },
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: '#161c27',
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#1b2230',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2f3a4e',
  },
  kpiLabel: {
    color: '#a2b2c7',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  kpiTotal: {
    fontSize: 12,
    color: '#748bac',
    fontWeight: '400',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#1b2230',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2f3a4e',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#293243',
  },
  tabActive: {
    backgroundColor: '#f08b65',
  },
  tabText: {
    color: '#a2b2c7',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 40,
    color: '#10b981',
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#f4f6f8',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    color: '#a2b2c7',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  bookingCard: {
    backgroundColor: '#1b2230',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2f3a4e',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bookingId: {
    color: '#f4f6f8',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  statusPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusPillPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  statusPillAssigned: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  routeContainer: {
    marginBottom: 10,
    gap: 4,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeDotGreen: {
    color: '#10b981',
    fontSize: 12,
  },
  routeDotOrange: {
    color: '#f08b65',
    fontSize: 10,
  },
  routeText: {
    color: '#c9d3df',
    fontSize: 13,
    flex: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#293243',
    marginBottom: 10,
  },
  detailText: {
    color: '#a2b2c7',
    fontSize: 12,
  },
  fareText: {
    color: '#f4f6f8',
    fontSize: 15,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverAssignedInfo: {
    flex: 1,
    marginRight: 10,
  },
  driverLabel: {
    color: '#748bac',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  driverName: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  unassignedText: {
    color: '#f59e0b',
    fontSize: 11,
    fontStyle: 'italic',
  },
  appointBtn: {
    backgroundColor: '#f08b65',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  reappointBtn: {
    backgroundColor: '#2563eb',
  },
  appointBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1b2230',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#3b475d',
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#f4f6f8',
    fontSize: 17,
    fontWeight: '700',
  },
  modalCloseText: {
    color: '#a2b2c7',
    fontSize: 16,
    fontWeight: '700',
    padding: 4,
  },
  modalBookingSummary: {
    backgroundColor: '#161c27',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  modalSummaryText: {
    color: '#f4f6f8',
    fontSize: 12,
    fontWeight: '700',
  },
  modalSummaryRoute: {
    color: '#a2b2c7',
    fontSize: 11,
    marginTop: 2,
  },
  modalSubheading: {
    color: '#c9d3df',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  driverSelectCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#293243',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2f3a4e',
  },
  driverSelectName: {
    color: '#f4f6f8',
    fontSize: 14,
    fontWeight: '700',
  },
  driverSelectPhone: {
    color: '#a2b2c7',
    fontSize: 12,
    marginTop: 1,
  },
  driverSelectLicense: {
    color: '#748bac',
    fontSize: 11,
    marginTop: 1,
  },
  selectArrow: {
    color: '#f08b65',
    fontSize: 13,
    fontWeight: '700',
  },
  modalCancelBtn: {
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#293243',
  },
  modalCancelText: {
    color: '#c9d3df',
    fontSize: 13,
    fontWeight: '600',
  },
  fleetBanner: {
    backgroundColor: '#1b2230',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(240, 139, 101, 0.3)',
  },
  fleetBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fleetBannerTitle: {
    color: '#f4f6f8',
    fontSize: 13,
    fontWeight: '700',
  },
  fleetQueueActiveBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fleetQueueActiveText: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: '700',
  },
  fleetBannerModels: {
    color: '#a2b2c7',
    fontSize: 11,
    lineHeight: 16,
  },
  queuePosBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  queuePosActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  queuePosQueued: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  queuePosText: {
    fontSize: 10,
    fontWeight: '700',
  },
  queuePosActiveText: {
    color: '#22c55e',
  },
  queuePosQueuedText: {
    color: '#f59e0b',
  },
  drvQueueBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  drvQueueAvailable: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  drvQueueSingle: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  drvQueueMultiple: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    borderColor: 'rgba(249, 115, 22, 0.4)',
  },
  drvQueueText: {
    fontSize: 10,
    fontWeight: '700',
  },
  drvQueueAvailableText: {
    color: '#22c55e',
  },
  drvQueueSingleText: {
    color: '#f59e0b',
  },
  drvQueueMultipleText: {
    color: '#fb923c',
  },
});
