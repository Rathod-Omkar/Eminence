import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';

interface AdminMenuModalProps {
  visible: boolean;
  onClose: () => void;
  activeRoute?: string;
  onOpenAddDriver?: () => void;
  onOpenAddAdmin?: () => void;
}

interface NavItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  route: string;
  badge?: string;
}

interface NavGroup {
  category: string;
  items: NavItem[];
}

export default function AdminMenuModal({
  visible,
  onClose,
  activeRoute,
  onOpenAddDriver,
  onOpenAddAdmin,
}: AdminMenuModalProps) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleNavigate = (route: string) => {
    onClose();
    router.push(route as any);
  };

  const handleLogout = async () => {
    onClose();
    await logout();
    router.replace('/(auth)/login');
  };

  const navItems: NavGroup[] = [
    {
      category: 'Core Operations',
      items: [
        {
          id: 'dashboard',
          title: 'Dashboard Overview',
          subtitle: 'KPIs, real-time surge & revenue charts',
          icon: '📊',
          route: '/(admin)/dashboard',
        },
        {
          id: 'dispatch',
          title: 'Appoint Work / Dispatch',
          subtitle: 'Dispatch pending bookings to drivers',
          icon: '📋',
          route: '/(admin)/dispatch',
        },
      ],
    },
    {
      category: 'User & Fleet Management',
      items: [
        {
          id: 'admins',
          title: 'Administrators',
          subtitle: 'Add new admins & manage system access',
          icon: '🛡️',
          route: '/(admin)/admins',
          badge: 'Staff',
        },
        {
          id: 'fleet',
          title: 'Drivers & Fleet Vehicles',
          subtitle: 'Add drivers, verify licenses & manage tempos',
          icon: '🚚',
          route: '/(admin)/fleet',
          badge: 'Fleet',
        },
        {
          id: 'customers',
          title: 'Customer Accounts',
          subtitle: 'Search, review & manage B2B & B2C customers',
          icon: '👥',
          route: '/(admin)/customers',
          badge: 'Users',
        },
      ],
    },
    {
      category: 'Live Telematics & Quality',
      items: [
        {
          id: 'telematics',
          title: 'Real-Time Telematics & IoT',
          subtitle: 'Speed, RPM, Temp & diagnostics',
          icon: '📡',
          route: '/(admin)/telematics',
        },
        {
          id: 'support',
          title: 'Live Support Chat Inbox',
          subtitle: 'Real-time customer & driver support',
          icon: '💬',
          route: '/(admin)/support',
        },
        {
          id: 'audit',
          title: 'Audit Logs & SLA Health',
          subtitle: 'Compliance logs & uptime metrics',
          icon: '📜',
          route: '/(admin)/audit',
        },
      ],
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.menuContainer}>
          {/* Menu Header */}
          <View style={styles.menuHeader}>
            <View style={styles.headerInfo}>
              <View style={styles.badgeRow}>
                <Text style={styles.adminBadge}>🛡️ SUPER ADMIN</Text>
              </View>
              <Text style={styles.adminName}>{user?.name || 'Operations Lead'}</Text>
              <Text style={styles.adminEmail}>{user?.email || 'admin@eminence.com'}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Shortcuts */}
          <View style={styles.quickShortcuts}>
            <TouchableOpacity
              style={styles.shortcutBtn}
              onPress={() => {
                onClose();
                if (onOpenAddAdmin) onOpenAddAdmin();
                else router.push('/(admin)/admins' as any);
              }}
            >
              <Text style={styles.shortcutBtnIcon}>➕</Text>
              <Text style={styles.shortcutBtnText}>Add Admin</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shortcutBtn, styles.shortcutBtnSecondary]}
              onPress={() => {
                onClose();
                if (onOpenAddDriver) onOpenAddDriver();
                else router.push('/(admin)/fleet' as any);
              }}
            >
              <Text style={styles.shortcutBtnIcon}>🚚</Text>
              <Text style={styles.shortcutBtnText}>Add Driver</Text>
            </TouchableOpacity>
          </View>

          {/* Navigation Links Scroll */}
          <ScrollView
            style={styles.scrollList}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {navItems.map((group, gIdx) => (
              <View key={`group-${gIdx}`} style={styles.groupContainer}>
                <Text style={styles.groupCategory}>{group.category.toUpperCase()}</Text>
                {group.items.map((item) => {
                  const isActive = activeRoute === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.menuItem, isActive && styles.menuItemActive]}
                      onPress={() => handleNavigate(item.route)}
                    >
                      <View style={styles.itemIconContainer}>
                        <Text style={styles.itemIcon}>{item.icon}</Text>
                      </View>
                      <View style={styles.itemContent}>
                        <View style={styles.itemTitleRow}>
                          <Text style={[styles.itemTitle, isActive && styles.itemTitleActive]}>
                            {item.title}
                          </Text>
                          {item.badge && (
                            <View style={styles.badgeContainer}>
                              <Text style={styles.badgeText}>{item.badge}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.itemSubtitle} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      </View>
                      <Text style={[styles.chevron, isActive && styles.chevronActive]}>›</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          {/* Menu Footer */}
          <View style={styles.menuFooter}>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutBtnText}>🚪 Logout Admin Session</Text>
            </TouchableOpacity>
            <Text style={styles.versionText}>Eminence Enterprise Logistics v2.4</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  menuContainer: {
    width: Platform.OS === 'web' ? 380 : '86%',
    maxWidth: 400,
    backgroundColor: '#161d2b',
    borderLeftWidth: 1,
    borderLeftColor: '#2b3648',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  menuHeader: {
    paddingTop: 54,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#1f293d',
    borderBottomWidth: 1,
    borderBottomColor: '#2b3648',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerInfo: {
    flex: 1,
  },
  badgeRow: {
    marginBottom: 6,
  },
  adminBadge: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    letterSpacing: 0.5,
  },
  adminName: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700',
  },
  adminEmail: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2d3748',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  closeBtnText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: 'bold',
  },
  quickShortcuts: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: '#1a2233',
    borderBottomWidth: 1,
    borderBottomColor: '#2b3648',
  },
  shortcutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 6,
  },
  shortcutBtnSecondary: {
    backgroundColor: '#0d9488',
  },
  shortcutBtnIcon: {
    fontSize: 13,
  },
  shortcutBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  groupContainer: {
    marginBottom: 20,
  },
  groupCategory: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e2638',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2b3648',
  },
  menuItemActive: {
    backgroundColor: '#23304a',
    borderColor: '#3b82f6',
  },
  itemIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#29354a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemIcon: {
    fontSize: 18,
  },
  itemContent: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 6,
  },
  itemTitle: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
  },
  itemTitleActive: {
    color: '#60a5fa',
    fontWeight: '700',
  },
  itemSubtitle: {
    color: '#8599b3',
    fontSize: 11,
    marginTop: 2,
  },
  badgeContainer: {
    backgroundColor: '#334155',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#93c5fd',
    fontSize: 9,
    fontWeight: '700',
  },
  chevron: {
    color: '#64748b',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 4,
  },
  chevronActive: {
    color: '#60a5fa',
  },
  menuFooter: {
    padding: 16,
    backgroundColor: '#1a2233',
    borderTopWidth: 1,
    borderTopColor: '#2b3648',
  },
  logoutBtn: {
    backgroundColor: '#dc2626',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  versionText: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
  },
});
