import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export default function BookScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [pickup, setPickup] = useState('');
  const [drops, setDrops] = useState<string[]>(['']);
  const [tempoType, setTempoType] = useState<'small' | 'medium' | 'large'>('small');
  const [weight, setWeight] = useState('');
  const [goodsType, setGoodsType] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('14:00');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online' | 'wallet'>('online');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Saved Addresses & Live OSRM Road Distance
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [roadDistanceKm, setRoadDistanceKm] = useState<number>(0);
  const [roadDurationMin, setRoadDurationMin] = useState<number>(0);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState<boolean>(false);
  const [scopeWarning, setScopeWarning] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/address').then((res) => {
      if (res.data?.success && Array.isArray(res.data.addresses)) {
        setSavedAddresses(res.data.addresses);
      } else if (Array.isArray(res.data)) {
        setSavedAddresses(res.data);
      }
    }).catch(() => {});

    api.get('/api/wallet').then((res) => {
      const bal = res.data?.wallet?.balance ?? res.data?.balance ?? 0;
      setWalletBalance(parseFloat(bal) || 0);
    }).catch((err) => {
      console.warn('Could not load wallet balance:', err.message);
      setWalletBalance(0);
    });
  }, []);

  // Known Pune Localities & Landmarks Mapping (zero-latency, distinct coordinates)
  const knownPuneLocations: Record<string, { lat: number; lon: number }> = {
    'sai maruti': { lat: 18.5195, lon: 73.8448 },
    'sai service': { lat: 18.5195, lon: 73.8448 },
    'sp kaanara': { lat: 18.5190, lon: 73.8445 },
    'jm road': { lat: 18.5191, lon: 73.8451 },
    'jangali maharaj': { lat: 18.5191, lon: 73.8451 },
    'bmcc': { lat: 18.5209, lon: 73.8354 },
    'brihan maharashtra': { lat: 18.5209, lon: 73.8354 },
    'deccan': { lat: 18.5173, lon: 73.8415 },
    'deccan gymkhana': { lat: 18.5173, lon: 73.8415 },
    'wagholi': { lat: 18.5806, lon: 73.9833 },
    'hinjewadi': { lat: 18.5913, lon: 73.7389 },
    'hadapsar': { lat: 18.5089, lon: 73.9260 },
    'viman nagar': { lat: 18.5679, lon: 73.9143 },
    'kothrud': { lat: 18.5074, lon: 73.8077 },
    'baner': { lat: 18.5590, lon: 73.7868 },
    'wakad': { lat: 18.5987, lon: 73.7688 },
    'kharadi': { lat: 18.5516, lon: 73.9349 },
    'chakan': { lat: 18.7606, lon: 73.8636 },
    'bhosari': { lat: 18.6279, lon: 73.8447 },
    'nigdi': { lat: 18.6542, lon: 73.7663 },
    'pcmc': { lat: 18.6298, lon: 73.7997 },
    'pimpri': { lat: 18.6298, lon: 73.7997 },
    'chinchwad': { lat: 18.6298, lon: 73.7997 },
    'katraj': { lat: 18.4575, lon: 73.8677 },
    'swargate': { lat: 18.5018, lon: 73.8586 },
    'shivajinagar': { lat: 18.5314, lon: 73.8446 },
    'magarpatta': { lat: 18.5146, lon: 73.9288 },
    'aundh': { lat: 18.5580, lon: 73.8075 },
    'kondhwa': { lat: 18.4739, lon: 73.8938 },
    'senapati bapat': { lat: 18.5323, lon: 73.8315 },
    'sb road': { lat: 18.5323, lon: 73.8315 },
    'fc road': { lat: 18.5246, lon: 73.8419 },
    'fergusson': { lat: 18.5246, lon: 73.8419 },
    'camp': { lat: 18.5134, lon: 73.8791 },
    'koregaon park': { lat: 18.5362, lon: 73.8940 },
    'yerwada': { lat: 18.5529, lon: 73.8797 },
    'alandi': { lat: 18.6775, lon: 73.8967 },
    'tathawade': { lat: 18.6161, lon: 73.7483 },
    'ravet': { lat: 18.6473, lon: 73.7381 },
    'bavdhan': { lat: 18.5113, lon: 73.7715 },
    'warje': { lat: 18.4842, lon: 73.7996 },
    'sinhagad': { lat: 18.4485, lon: 73.8262 },
    'dhanori': { lat: 18.5866, lon: 73.8878 },
    'lohegaon': { lat: 18.5982, lon: 73.9189 }
  };

  // Live OSRM Road Route Calculation bounded strictly to Pune & PCMC Metropolitan (PMRDA)
  useEffect(() => {
    if (!pickup || pickup.trim().length < 3 || !drops[0] || drops[0].trim().length < 3) {
      setRoadDistanceKm(0);
      setRoadDurationMin(0);
      setScopeWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCalculatingRoute(true);
      try {
        const geocode = async (query: string): Promise<{ lat: number; lon: number } | null> => {
          const lower = query.toLowerCase().trim();
          for (const [key, coord] of Object.entries(knownPuneLocations)) {
            if (lower.includes(key)) {
              return coord;
            }
          }

          let q = query;
          if (!q.toLowerCase().includes('pune')) q += ', Pune';
          const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=in&limit=3&viewbox=73.60,18.85,74.20,18.30&bounded=1`;
          const res = await fetch(url, {
            headers: {
              'Accept-Language': 'en',
              'User-Agent': 'Eminence-Transport-MVP/1.0',
            },
          });
          const data = await res.json();
          if (Array.isArray(data)) {
            for (const item of data) {
              const lat = parseFloat(item.lat);
              const lon = parseFloat(item.lon);
              if (lat >= 18.25 && lat <= 18.90 && lon >= 73.55 && lon <= 74.25) {
                return { lat, lon };
              }
            }
          }
          return null;
        };

        const start = await geocode(pickup);
        const end = await geocode(drops[0]);

        if (!start || !end) {
          setScopeWarning('One or more addresses are outside the Pune & PCMC service boundary. Eminence tempo operations are restricted to Pune.');
          setRoadDistanceKm(0);
          setRoadDurationMin(0);
          return;
        }

        setScopeWarning(null);

        // Guard against identical coordinates
        const isSame = Math.abs(start.lat - end.lat) < 0.0005 && Math.abs(start.lon - end.lon) < 0.0005;
        if (isSame) {
          setRoadDistanceKm(0);
          setRoadDurationMin(0);
          return;
        }

        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=false`;
        const routeRes = await fetch(osrmUrl);
        const routeData = await routeRes.json();
        if (routeData.code === 'Ok' && routeData.routes?.[0]) {
          const distKm = parseFloat((routeData.routes[0].distance / 1000).toFixed(1));
          const durMin = Math.round(routeData.routes[0].duration / 60);
          setRoadDistanceKm(distKm);
          setRoadDurationMin(durMin);
        }
      } catch (e) {
        console.warn('OSRM routing fetch error:', e);
      } finally {
        setIsCalculatingRoute(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [pickup, drops[0]]);

  // Fare Estimation
  const calculateEstimatedFare = () => {
    const baseRates = { small: 350, medium: 550, large: 1100 };
    let total = baseRates[tempoType] || 350;

    // Surcharge for extra multi-stops (+₹150 each)
    if (drops.length > 1) {
      total += (drops.length - 1) * 150;
    }

    // Small weight adjustment
    const w = parseFloat(weight) || 0;
    if (w > 200) {
      total += Math.round((w - 200) * 0.5);
    }

    // Distance adjustment if road distance > 5km
    if (roadDistanceKm > 5) {
      total += Math.round((roadDistanceKm - 5) * 18);
    }

    // 5% Eminence Pro discount
    if (user?.isPro) {
      total = Math.round(total * 0.95);
    }

    return total;
  };

  const addStop = () => {
    if (drops.length >= 4) {
      Alert.alert('Limit Reached', 'Maximum 4 stops allowed per booking');
      return;
    }
    setDrops([...drops, '']);
  };

  const removeStop = (index: number) => {
    if (drops.length <= 1) return;
    const next = [...drops];
    next.splice(index, 1);
    setDrops(next);
  };

  const handleDropChange = (index: number, val: string) => {
    const next = [...drops];
    next[index] = val;
    setDrops(next);
  };

  const handleConfirmBooking = async () => {
    if (!pickup.trim()) {
      setErrorMessage('Please enter a pickup address');
      return;
    }
    if (drops.some((d) => !d.trim())) {
      setErrorMessage('Please fill in all destination drop stops');
      return;
    }
    const cleanPickup = pickup.trim().toLowerCase();
    if (drops.some((d) => d.trim().toLowerCase() === cleanPickup)) {
      setErrorMessage('Pickup and drop destinations cannot be identical. Please select a different delivery address.');
      return;
    }
    if (!weight || parseInt(weight, 10) <= 0) {
      setErrorMessage('Please specify cargo weight in kg');
      return;
    }

    const estimatedFare = calculateEstimatedFare();

    if (paymentMethod === 'wallet') {
      if (walletBalance !== null && walletBalance < estimatedFare) {
        setErrorMessage(`Insufficient wallet balance (₹${walletBalance.toFixed(2)}). Total fare is ₹${estimatedFare}. Please recharge your wallet or choose another payment method.`);
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const payload = {
        pickupAddress: pickup.trim(),
        dropAddress: drops[0].trim(),
        drops: drops.map((d) => d.trim()),
        totalDistance: roadDistanceKm || 12,
        tempoType,
        weight: parseInt(weight, 10),
        goodsType: goodsType.trim(),
        date,
        time,
        estimatedFare,
        paymentMethod,
        customerId: user?.id,
      };

      const res = await api.post('/api/bookings', payload);

      if (res.data?.success && res.data?.booking) {
        const bookingId = res.data.booking.id;
        
        if (paymentMethod === 'online') {
          // Initialize Razorpay Order
          try {
            const orderRes = await api.post('/api/integrations/razorpay-order', { bookingId });
            setCurrentBookingId(bookingId);
            setCurrentOrder(orderRes.data?.order);
            setShowRazorpay(true);
          } catch (err) {
            setErrorMessage('Razorpay initialization failed');
          }
        } else {
          router.replace(`/(customer)/track?bookingId=${bookingId}` as any);
        }
      } else {
        setErrorMessage(res.data?.message || 'Failed to create booking');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Error creating booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRazorpaySuccess = async () => {
    if (!currentBookingId || !currentOrder) return;
    setIsSubmitting(true);
    try {
      await api.post('/api/integrations/razorpay-verify', {
        razorpay_order_id: currentOrder.id,
        razorpay_payment_id: 'pay_mock_' + Math.random().toString(36).substring(7),
        razorpay_signature: 'mock_signature'
      });
      setShowRazorpay(false);
      router.replace(`/(customer)/track?bookingId=${currentBookingId}` as any);
    } catch (err) {
      setErrorMessage('Payment Verification Failed');
      setShowRazorpay(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpiPayment = async () => {
    const amount = currentOrder?.amount ? (currentOrder.amount / 100).toFixed(2) : estimatedFare.toFixed(2);
    const upiUrl = `upi://pay?pa=eminence.logistics@icici&pn=Eminence%20Logistics&am=${amount}&cu=INR&tn=Booking%20${currentBookingId || 'Fare'}`;

    try {
      const canOpen = await Linking.canOpenURL(upiUrl);
      if (canOpen) {
        await Linking.openURL(upiUrl);
      } else {
        Alert.alert(
          'UPI Intent',
          `Dispatched UPI transaction intent for ₹${amount}. Confirming payment.`,
          [{ text: 'Proceed', onPress: handleRazorpaySuccess }]
        );
      }
    } catch (e) {
      console.warn('UPI intent launch error:', e);
      handleRazorpaySuccess();
    }
  };

  const estimatedFare = calculateEstimatedFare();

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book a Tempo</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* SECTION 1: PICKUP & MULTI-STOP DROPS */}
        <View style={styles.card}>
          <View style={styles.serviceAreaBadge}>
            <Text style={styles.serviceAreaBadgeText}>📍 Service Area: Pune & PCMC Metropolitan Region Only</Text>
          </View>
          <Text style={styles.cardTitle}>📍 Route & Stops</Text>

          <Text style={styles.inputLabel}>Pickup Address (Pune)</Text>
          <TextInput
            style={styles.input}
            value={pickup}
            onChangeText={setPickup}
            placeholder="e.g. BMCC, Deccan Gymkhana, Pune"
            placeholderTextColor="#748bac"
          />

          {/* Quick Saved Address Chips */}
          {savedAddresses.length > 0 && (
            <View style={{ marginTop: 6, marginBottom: 8 }}>
              <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>Quick-select Saved Address:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {savedAddresses.map((addr) => (
                  <TouchableOpacity
                    key={'pickup-' + addr.id}
                    style={styles.addressChip}
                    onPress={() => setPickup(`${addr.street}, ${addr.city}`)}
                  >
                    <Text style={styles.addressChipIcon}>
                      {addr.label?.toLowerCase().includes('home') ? '🏠' : addr.label?.toLowerCase().includes('office') ? '🏢' : '📍'}
                    </Text>
                    <Text style={styles.addressChipText}>{addr.label || 'Saved'}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {drops.map((dropVal, idx) => (
            <View key={idx} style={{ marginTop: 12 }}>
              <View style={styles.dropHeaderRow}>
                <Text style={styles.inputLabel}>
                  {idx === 0 ? 'Destination Drop Address (Pune)' : `Additional Stop #${idx + 1}`}
                </Text>
                {idx > 0 && (
                  <TouchableOpacity onPress={() => removeStop(idx)}>
                    <Text style={styles.removeStopText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={styles.input}
                value={dropVal}
                onChangeText={(val) => handleDropChange(idx, val)}
                placeholder={idx === 0 ? 'e.g. Wagholi, Pune' : `Stop #${idx + 1} Address in Pune`}
                placeholderTextColor="#748bac"
              />

              {/* Quick Saved Address Chips for Drops */}
              {savedAddresses.length > 0 && (
                <View style={{ marginTop: 6, marginBottom: 4 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>Quick-select Destination:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {savedAddresses.map((addr) => (
                      <TouchableOpacity
                        key={'drop-' + idx + '-' + addr.id}
                        style={styles.addressChip}
                        onPress={() => handleDropChange(idx, `${addr.street}, ${addr.city}`)}
                      >
                        <Text style={styles.addressChipIcon}>
                          {addr.label?.toLowerCase().includes('home') ? '🏠' : addr.label?.toLowerCase().includes('office') ? '🏢' : '📍'}
                        </Text>
                        <Text style={styles.addressChipText}>{addr.label || 'Saved'}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          ))}

          {/* Out of Service Boundary Warning */}
          {scopeWarning ? (
            <View style={styles.outOfScopeNotice}>
              <Text style={styles.outOfScopeText}>⚠️ {scopeWarning}</Text>
            </View>
          ) : null}

          {/* OSRM Road Distance Telematics Badge */}
          {isCalculatingRoute ? (
            <View style={styles.routePill}>
              <ActivityIndicator size="small" color="#f59e0b" style={{ marginRight: 6 }} />
              <Text style={styles.routePillText}>Calculating road route distance via OSRM...</Text>
            </View>
          ) : roadDistanceKm > 0 ? (
            <View style={styles.routeCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 14 }}>🛣️</Text>
                  <Text style={{ color: '#f59e0b', fontWeight: '700', fontSize: 12 }}>Point A to Point B Route</Text>
                </View>
                <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '700' }}>● High Precision</Text>
              </View>
              <View style={{ flexDirection: 'row', marginTop: 8, justifyContent: 'space-around' }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 10 }}>ROAD DISTANCE</Text>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{roadDistanceKm} km</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 10 }}>DRIVE TIME</Text>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>~{roadDurationMin} mins</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 10 }}>CO₂ FOOTPRINT</Text>
                  <Text style={{ color: '#10b981', fontSize: 15, fontWeight: '800' }}>{(roadDistanceKm * 0.12).toFixed(1)} kg</Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Add Stop Button (TC-012) */}
          <TouchableOpacity style={styles.addStopBtn} onPress={addStop}>
            <Text style={styles.addStopBtnText}>+ Add Another Stop (+₹150)</Text>
          </TouchableOpacity>
        </View>

        {/* SECTION 2: VEHICLE SELECTION */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🚚 Select Vehicle Size</Text>

          <View style={styles.tempoGrid}>
            <TouchableOpacity
              style={[styles.tempoOption, tempoType === 'small' && styles.tempoOptionActive]}
              onPress={() => setTempoType('small')}
            >
              <Text style={styles.tempoIcon}>🛺</Text>
              <Text style={styles.tempoName}>Small</Text>
              <Text style={styles.tempoModel}>Tata Ace</Text>
              <Text style={styles.tempoWeight}>Max 500kg</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tempoOption, tempoType === 'medium' && styles.tempoOptionActive]}
              onPress={() => setTempoType('medium')}
            >
              <Text style={styles.tempoIcon}>🚐</Text>
              <Text style={styles.tempoName}>Medium</Text>
              <Text style={styles.tempoModel}>Bolero Pickup</Text>
              <Text style={styles.tempoWeight}>Max 1,200kg</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tempoOption, tempoType === 'large' && styles.tempoOptionActive]}
              onPress={() => setTempoType('large')}
            >
              <Text style={styles.tempoIcon}>🚛</Text>
              <Text style={styles.tempoName}>Large</Text>
              <Text style={styles.tempoModel}>14ft Truck</Text>
              <Text style={styles.tempoWeight}>Max 2,500kg</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION 3: CARGO DETAILS */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📦 Cargo Specifications</Text>

          <View style={styles.rowInputs}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.inputLabel}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                placeholder="150"
                placeholderTextColor="#748bac"
              />
            </View>

            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.inputLabel}>Goods Category</Text>
              <TextInput
                style={styles.input}
                value={goodsType}
                onChangeText={setGoodsType}
                placeholder="Electronics"
                placeholderTextColor="#748bac"
              />
            </View>
          </View>

          <View style={[styles.rowInputs, { marginTop: 12 }]}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.inputLabel}>Pickup Date</Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#748bac"
              />
            </View>

            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.inputLabel}>Pickup Time</Text>
              <TextInput
                style={styles.input}
                value={time}
                onChangeText={setTime}
                placeholder="14:00"
                placeholderTextColor="#748bac"
              />
            </View>
          </View>
        </View>

        {/* SECTION 4: PAYMENT METHOD */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={styles.cardTitle}>💳 Payment Method</Text>
            {walletBalance !== null && (
              <Text style={{ fontSize: 12, color: '#f08b65', fontWeight: '600' }}>
                Wallet: ₹{walletBalance.toFixed(2)}
              </Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.tempoOption, paymentMethod === 'online' && styles.tempoOptionActive, { flex: 1, paddingVertical: 10 }]}
              onPress={() => setPaymentMethod('online')}
            >
              <Text style={{ fontSize: 20, marginBottom: 2 }}>UPI</Text>
              <Text style={[styles.tempoName, { fontSize: 13 }]}>Online</Text>
              <Text style={styles.tempoModel}>Cards/UPI</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tempoOption, paymentMethod === 'cash' && styles.tempoOptionActive, { flex: 1, paddingVertical: 10 }]}
              onPress={() => setPaymentMethod('cash')}
            >
              <Text style={{ fontSize: 20, marginBottom: 2 }}>💵</Text>
              <Text style={[styles.tempoName, { fontSize: 13 }]}>Cash</Text>
              <Text style={styles.tempoModel}>Pay to Driver</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tempoOption, paymentMethod === 'wallet' && styles.tempoOptionActive, { flex: 1, paddingVertical: 10 }]}
              onPress={() => setPaymentMethod('wallet')}
            >
              <Text style={{ fontSize: 20, marginBottom: 2 }}>👛</Text>
              <Text style={[styles.tempoName, { fontSize: 13 }]}>Wallet</Text>
              <Text style={[styles.tempoModel, walletBalance !== null && walletBalance < estimatedFare ? { color: '#ef4444' } : { color: '#4ade80' }]}>
                {walletBalance !== null ? (walletBalance >= estimatedFare ? '₹' + walletBalance.toFixed(0) : 'Low Bal') : 'Wallet'}
              </Text>
            </TouchableOpacity>
          </View>

          {paymentMethod === 'wallet' && walletBalance !== null && walletBalance < estimatedFare && (
            <View style={{ marginTop: 10, padding: 10, backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
              <Text style={{ color: '#fca5a5', fontSize: 12 }}>
                ⚠️ Wallet balance (₹{walletBalance.toFixed(2)}) is less than total fare (₹{estimatedFare}). Please choose another method or top up.
              </Text>
            </View>
          )}
        </View>

        {/* SECTION 5: FARE BREAKDOWN & CONFIRM */}
        <View style={styles.fareCard}>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Base Fare ({tempoType.toUpperCase()})</Text>
            <Text style={styles.fareVal}>
              ₹{tempoType === 'small' ? 350 : tempoType === 'medium' ? 550 : 1100}
            </Text>
          </View>

          {drops.length > 1 && (
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Multi-Stop Surcharge ({drops.length - 1} stops)</Text>
              <Text style={styles.fareVal}>₹{(drops.length - 1) * 150}</Text>
            </View>
          )}

          {roadDistanceKm > 0 && (
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Road Distance ({roadDistanceKm} km)</Text>
              <Text style={styles.fareVal}>
                {roadDistanceKm > 5 ? `+₹${Math.round((roadDistanceKm - 5) * 18)}` : 'Included'}
              </Text>
            </View>
          )}

          {user?.isPro && (
            <View style={styles.fareRow}>
              <Text style={[styles.fareLabel, { color: '#f59e0b' }]}>⭐ Eminence Pro (5% Discount)</Text>
              <Text style={[styles.fareVal, { color: '#f59e0b' }]}>Applied</Text>
            </View>
          )}

          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Estimated CO2 Offset</Text>
            <Text style={styles.esgVal}>🌿 ~{roadDistanceKm > 0 ? (roadDistanceKm * 0.12).toFixed(1) : '3.2'} kg</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Estimated Cost</Text>
            <Text style={styles.totalVal}>₹{estimatedFare}</Text>
          </View>

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={handleConfirmBooking}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmBtnText}>Confirm Booking (₹{estimatedFare})</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* RAZORPAY NATIVE MODAL MOCK */}
      <Modal visible={showRazorpay} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: '#0f141f', padding: 20, justifyContent: 'center' }}>
          <View style={{ backgroundColor: '#1a2235', padding: 24, borderRadius: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>⚡</Text>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Razorpay Checkout (Mock)</Text>
            <Text style={{ color: '#b87333', fontSize: 24, fontWeight: 'bold', marginBottom: 24 }}>
              ₹{currentOrder?.amount ? currentOrder.amount / 100 : estimatedFare}
            </Text>
            
            <TouchableOpacity 
              style={[styles.confirmBtn, { width: '100%', marginBottom: 12, backgroundColor: '#059669' }]} 
              onPress={handleUpiPayment}
            >
              <Text style={styles.confirmBtnText}>Pay via UPI (GPay / PhonePe / Paytm)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.confirmBtn, { width: '100%', marginBottom: 12 }]} 
              onPress={handleRazorpaySuccess}
            >
              <Text style={styles.confirmBtnText}>Pay via Cards / NetBanking</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.confirmBtn, { width: '100%', backgroundColor: 'transparent', borderWidth: 1, borderColor: '#334155' }]} 
              onPress={() => setShowRazorpay(false)}
            >
              <Text style={styles.confirmBtnText}>Cancel Payment</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    backgroundColor: '#293243',
    borderBottomWidth: 1,
    borderBottomColor: '#2f3a4e',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#2f3a4e',
  },
  backBtnText: {
    color: '#c9d3df',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#f4f6f8',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#293243',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2f3a4e',
  },
  cardTitle: {
    color: '#f4f6f8',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  inputLabel: {
    color: '#a2b2c7',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  dropHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  removeStopText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0f141f',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2f3a4e',
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: '#f4f6f8',
    fontSize: 14,
  },
  addStopBtn: {
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e86331',
    borderStyle: 'dashed',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 99, 49, 0.05)',
  },
  addStopBtnText: {
    color: '#f08b65',
    fontSize: 13,
    fontWeight: '600',
  },
  tempoGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  tempoOption: {
    flex: 1,
    backgroundColor: '#0f141f',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2f3a4e',
  },
  tempoOptionActive: {
    borderColor: '#e86331',
    backgroundColor: 'rgba(232, 99, 49, 0.1)',
  },
  tempoIcon: {
    fontSize: 26,
    marginBottom: 4,
  },
  tempoName: {
    color: '#f4f6f8',
    fontSize: 14,
    fontWeight: '700',
  },
  tempoModel: {
    color: '#a2b2c7',
    fontSize: 11,
    marginTop: 2,
  },
  tempoWeight: {
    color: '#f08b65',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  rowInputs: {
    flexDirection: 'row',
  },
  fareCard: {
    backgroundColor: '#293243',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e86331',
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fareLabel: {
    color: '#a2b2c7',
    fontSize: 13,
  },
  fareVal: {
    color: '#c9d3df',
    fontSize: 13,
    fontWeight: '600',
  },
  esgVal: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#2f3a4e',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    color: '#f4f6f8',
    fontSize: 16,
    fontWeight: '700',
  },
  totalVal: {
    color: '#e86331',
    fontSize: 24,
    fontWeight: '800',
  },
  confirmBtn: {
    backgroundColor: '#e86331',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#f4f6f8',
    fontSize: 16,
    fontWeight: '700',
  },
  addressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 6,
  },
  addressChipIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  addressChipText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  routePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e1b4b',
    borderWidth: 1,
    borderColor: '#6366f1',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
  },
  routePillText: {
    color: '#a5b4fc',
    fontSize: 11,
    fontWeight: '600',
  },
  routeCard: {
    backgroundColor: '#161f30',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  serviceAreaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10b981',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  serviceAreaBadgeText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
  },
  outOfScopeNotice: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  outOfScopeText: {
    color: '#f87171',
    fontSize: 11,
    lineHeight: 16,
  },
});
