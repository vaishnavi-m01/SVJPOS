import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { COLORS, SIZES, SHADOWS } from '../styles/theme';
import Header from '../components/Header';
import StorageService from '../services/StorageService';
import PrinterService from '../services/PrinterService';
import { formatCurrency } from '../utils/helpers';
import { RootStackParamList, RootTabParamList, Order, Item, Notification } from '../types';

const { width } = Dimensions.get('window');

type HomeScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<RootStackParamList, 'Home'>,
  BottomTabNavigationProp<RootTabParamList>
>;

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

interface Stats {
  todaySales: number;
  todayOrders: number;
  avgOrderValue: number;
  itemsSold: number;
}

interface MenuItemProps {
  icon: string;
  title: string;
  onPress: () => void;
  color?: string;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const [stats, setStats] = useState<Stats>({
    todaySales: 0,
    todayOrders: 0,
    avgOrderValue: 0,
    itemsSold: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStockItems, setLowStockItems] = useState<Item[]>([]);
  const [topSellingItems, setTopSellingItems] = useState<{ name: string; qty: number; icon: string }[]>([]);
  const [greeting, setGreeting] = useState('');
  const [printerStatus, setPrinterStatus] = useState<{ status: 'off' | 'disconnected' | 'connected'; message: string }>(
    PrinterService.isBluetoothEnabledSync()
      ? { status: 'disconnected', message: 'Detecting Printer...' }
      : { status: 'off', message: 'Bluetooth is OFF' }
  );
  console.log("[HomeScreen] Initial Printer Status State:", printerStatus);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem('@notifications');
      if (saved) {
        const list: Notification[] = JSON.parse(saved);
        setUnreadCount(list.filter(n => !n.read).length);
      } else {
        setUnreadCount(0);
      }
    } catch (e) {
      console.error(e);
      setUnreadCount(0);
    }
  }, []);

  const addNotification = useCallback(async (type: Notification['type'], title: string, message: string, severity: Notification['severity']) => {
    try {
      const saved = await AsyncStorage.getItem('@notifications');
      let notifications: Notification[] = saved ? JSON.parse(saved) : [];

      // Centralized Deduplication: Don't add if a notification with same message exists (read or unread)
      const isDuplicate = notifications.some(n => n.message === message);
      if (isDuplicate) return;

      const newNotif: Notification = {
        id: Date.now().toString(),
        type,
        title,
        message,
        time: 'Just now',
        read: false,
        severity,
      };

      notifications = [newNotif, ...notifications].slice(0, 50);
      await AsyncStorage.setItem('@notifications', JSON.stringify(notifications));
      loadNotifications();
    } catch (e) {
      console.error(e);
    }
  }, [loadNotifications]);

  useEffect(() => {
    const handleStatusChange = (_isConnected: boolean) => {
      // Ignore boolean, fetch detailed status
      PrinterService.getDetailedStatus().then(statusObj => {
        console.log("[HomeScreen] Detailed Status Changed:", statusObj);
        setPrinterStatus(statusObj);

        if (statusObj.status === 'connected') {
          addNotification(
            'printer',
            'Printer Connected',
            'Successfully connected to your POS printer.',
            'success'
          );
        } else {
          addNotification(
            'printer',
            'Printer Error',
            statusObj.message,
            'error'
          );
        }
      });
    };

    PrinterService.onConnectChange(handleStatusChange);

    // Initial check
    const checkStatus = () => {
      PrinterService.getDetailedStatus().then(statusObj => {
        console.log("[HomeScreen] Initial Status Check:", statusObj);
        setPrinterStatus(statusObj);
      });
    };
    checkStatus();

    return () => {
      PrinterService.offConnectChange(handleStatusChange);
    };
  }, [addNotification]);

  const updateGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting('Good Morning');
    } else if (hour < 17) {
      setGreeting('Good Afternoon');
    } else {
      setGreeting('Good Evening');
    }
  }, []);

  const loadData = useCallback(async () => {
    loadNotifications();
    const orders = await StorageService.getOrders();
    const items = await StorageService.getItems();
    const today = new Date().toDateString();

    const todayOrders = orders.filter(
      order => new Date(order.date).toDateString() === today
    );
    const todaySales = todayOrders.reduce((sum, order) => sum + order.total, 0);
    const itemsSold = todayOrders.reduce(
      (sum, order) => sum + order.items.reduce((s, i) => s + i.qty, 0),
      0
    );
    const avgOrderValue = todayOrders.length > 0 ? todaySales / todayOrders.length : 0;

    setStats({
      todaySales,
      todayOrders: todayOrders.length,
      avgOrderValue,
      itemsSold,
    });

    const recent = orders
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
    setRecentOrders(recent);

    const lowStock = items.filter(item => item.stock !== undefined && item.stock < 5);

    for (const item of lowStock) {
      await addNotification(
        'stock',
        'Low Stock Alert',
        `${item.name} is running low (${item.stock} left).`,
        'warning'
      );
    }

    setLowStockItems(lowStock);

    const itemSales: Record<string, number> = {};
    todayOrders.forEach(order => {
      order.items.forEach(item => {
        itemSales[item.name] = (itemSales[item.name] || 0) + item.qty;
      });
    });
    const topItems = Object.entries(itemSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, qty]) => ({ name, qty, icon: 'package-variant' }));
    setTopSellingItems(topItems);
  }, [loadNotifications, addNotification]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      updateGreeting();
      loadNotifications();
      // Refresh printer status on focus
      PrinterService.getDetailedStatus().then(setPrinterStatus);
    }, [loadData, updateGreeting, loadNotifications])
  );

  const getTimeAgo = (date: Date | string) => {
    const now = new Date();
    const orderDate = typeof date === 'string' ? new Date(date) : date;
    const diff = Math.floor((now.getTime() - orderDate.getTime()) / 1000 / 60);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff} min ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hr ago`;
    return `${Math.floor(diff / 1440)} days ago`;
  };

  const formatDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return new Date().toLocaleDateString('en-IN', options);
  };

  const MenuItem: React.FC<MenuItemProps> = ({ icon, title, onPress, color = COLORS.primary }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, { backgroundColor: color + '20' }]}>
        <Icon name={icon} size={28} color={color} />
      </View>
      <Text style={styles.menuLabel}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Header
        title={
          <View>
            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/images/SvjAppLogo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.logoText}>SVJPOS</Text>
            </View>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Online</Text>
            </View>
          </View>
        }
        rightComponent={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* <TouchableOpacity
              style={[styles.notificationBtn, { marginRight: 12 }]}
              onPress={() => navigation.navigate('Printer')}
            >
              <Icon name="cog-outline" size={24} color={COLORS.textPrimary} />
              {!printerConnected && <View style={[styles.notificationBadge, { backgroundColor: COLORS.danger }]} />}
            </TouchableOpacity> */}
            <TouchableOpacity
              style={styles.notificationBtn}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Icon name="bell-outline" size={24} color={COLORS.textPrimary} />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        }
      />

      {printerStatus.status !== 'connected' && (
        <TouchableOpacity
          style={[styles.alertBanner, { backgroundColor: COLORS.danger, borderLeftColor: COLORS.danger, marginHorizontal: 16 }]}
          onPress={() => navigation.navigate('Printer')}
        >
          <View style={styles.alertContent}>
            <Icon name={printerStatus.status === 'off' ? "bluetooth-off" : "printer-off"} size={24} color="#fff" />
            <View style={styles.alertTextContent}>
              <Text style={[styles.alertTitle, { color: '#fff' }]}>{printerStatus.message}</Text>
              <Text style={[styles.alertDescription, { color: 'rgba(255,255,255,0.8)' }]}>
                {printerStatus.status === 'off' ? 'Turn on Bluetooth to print' : 'Check printer or connect in Settings'}
              </Text>
            </View>
          </View>
          <Icon name="chevron-right" size={20} color="#fff" />
        </TouchableOpacity>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Greeting Banner */}
        <View style={styles.greetingSection}>
          <View style={styles.greetingCard}>
            <View style={styles.greetingLeft}>
              <View style={styles.greetingIconContainer}>
                <Icon
                  name={greeting === 'Good Morning' ? 'weather-partly-cloudy' : greeting === 'Good Afternoon' ? 'weather-sunny' : 'weather-night'}
                  size={32}
                  color="#FFD700"
                />
              </View>
              <View style={styles.greetingTextContainer}>
                <Text style={styles.greetingText}>{greeting}!</Text>
                <Text style={styles.dateText}>{formatDate()}</Text>
              </View>
            </View>
            <View style={styles.storeStatus}>
              <View style={styles.storeStatusDot} />
              <Text style={styles.storeStatusText}>Open</Text>
            </View>
          </View>
        </View>

        {/* Low Stock Alert */}
        {lowStockItems.length > 0 && (
          <TouchableOpacity
            style={styles.alertBanner}
            onPress={() => navigation.navigate('Items')}
          >
            <View style={styles.alertContent}>
              <Icon name="alert-circle" size={24} color="#F59E0B" />
              <View style={styles.alertTextContent}>
                <Text style={styles.alertTitle}>Low Stock Alert</Text>
                <Text style={styles.alertDescription}>
                  {lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} running low
                </Text>
              </View>
            </View>
            <Icon name="chevron-right" size={24} color="#F59E0B" />
          </TouchableOpacity>
        )}

        {/* Stats Grid */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Overview</Text>
          </View>

          <View style={styles.statsGrid}>
            {/* Primary Stat Card - Full Width */}
            <View style={styles.primaryStatCard}>
              <View style={styles.statIconObj}>
                <Icon name="cash" size={24} color="#fff" />
              </View>
              <View style={styles.primaryStatContent}>
                <Text style={styles.statLabelPrimary}>Total Sales</Text>
                <Text style={styles.statValuePrimary}>{formatCurrency(stats.todaySales)}</Text>
              </View>
              <View style={styles.statTrend}>
                <Icon name="trending-up" size={16} color="rgba(255,255,255,0.9)" />
                <Text style={styles.statChangePrimary}>+12.5%</Text>
              </View>
            </View>

            {/* Secondary Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statCardSmall}>
                <View style={[styles.statIconObjSecondary, { backgroundColor: COLORS.accent + '15' }]}>
                  <Icon name="receipt" size={18} color={COLORS.accent} />
                </View>
                <Text style={styles.statLabel}>Orders</Text>
                <Text
                  style={styles.statValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {stats.todayOrders}
                </Text>
              </View>

              <View style={styles.statCardSmall}>
                <View style={[styles.statIconObjSecondary, { backgroundColor: '#10B981' + '15' }]}>
                  <Icon name="chart-line" size={18} color="#10B981" />
                </View>
                <Text style={styles.statLabel}>Avg Order</Text>
                <Text
                  style={styles.statValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatCurrency(stats.avgOrderValue)}
                </Text>
              </View>

              <View style={styles.statCardSmall}>
                <View style={[styles.statIconObjSecondary, { backgroundColor: '#8B5CF6' + '15' }]}>
                  <Icon name="package-variant" size={18} color="#8B5CF6" />
                </View>
                <Text style={styles.statLabel}>Items</Text>
                <Text
                  style={styles.statValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {stats.itemsSold}
                </Text>

              </View>
            </View>

          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Sales')}
            >
              <View style={styles.actionIconBg}>
                <Icon name="cart-plus" size={24} color="#FFF" />
              </View>
              <Text style={styles.actionLabel}>New Sale</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryAction]}
              onPress={() => navigation.navigate('Items')}
            >
              <View style={[styles.actionIconBg, styles.secondaryIconBg]}>
                <Icon name="package-variant" size={24} color={COLORS.primary} />
              </View>
              <Text style={[styles.actionLabel, styles.secondaryActionLabel]}>
                Items
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Top Selling Items */}
        {topSellingItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Selling Today</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ReportsTab')}>
                <Text style={styles.seeAll}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.topItemsContainer}>
              {topSellingItems.map((item, index) => (
                <View key={index} style={styles.topItemCard}>
                  <View style={styles.topItemRank}>
                    <Text style={styles.topItemRankText}>#{index + 1}</Text>
                  </View>
                  <View style={styles.topItemInfo}>
                    <Text style={styles.topItemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.topItemQty}>{item.qty} sold</Text>
                  </View>
                  <Icon name="trending-up" size={20} color={COLORS.success} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recent Orders */}
        {recentOrders.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Orders</Text>
              <TouchableOpacity onPress={() => navigation.navigate('OrdersTab')}>
                <Text style={styles.seeAll}>View All</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.recentOrdersContainer}>
              {recentOrders.slice(0, 4).map((order, index) => (
                <View key={order.id || index} style={styles.orderCard}>
                  <View style={styles.orderLeft}>
                    <View style={styles.orderIconContainer}>
                      <Icon name="receipt" size={18} color={COLORS.primary} />
                    </View>
                    <View>
                      <Text style={styles.orderId}>#{(order.id || '000000').slice(-6)}</Text>
                      <Text style={styles.orderTime}>{getTimeAgo(order.date)}</Text>
                    </View>
                  </View>
                  <View style={styles.orderRight}>
                    <Text style={styles.orderAmount}>{formatCurrency(order.total)}</Text>
                    <View style={styles.orderStatusBadge}>
                      <Icon name="check-circle" size={12} color={COLORS.success} />
                      <Text style={styles.orderStatusText}>Paid</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}


        {/* Apps Menu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Apps</Text>
          <View style={styles.menuGrid}>
            <MenuItem
              icon="package-variant"
              title="Items"
              color="#4F46E5"
              onPress={() => navigation.navigate('Items')}
            />
            <MenuItem
              icon="cash-multiple"
              title="Sales"
              color="#10B981"
              onPress={() => navigation.navigate('Sales')}
            />
            <MenuItem
              icon="receipt"
              title="Tax"
              color="#EC4899"
              onPress={() => navigation.navigate('TaxMaster')}
            />
            <MenuItem
              icon="printer"
              title="Printer"
              color="#6366F1"
              onPress={() => navigation.navigate('Printer')}
            />
          </View>
        </View>

        {/* Bottom Spacing */}
        {/* <View style={{ height: 20 }} /> */}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  logoImage: {
    width: 35,
    height: 35,
    marginRight: 8,
  },

  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
  },

  logo: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    backgroundColor: COLORS.success + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  statusText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '600',
  },
  notificationBtn: {
    position: 'relative',
    padding: 2,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.accent,
    borderWidth: 1.5,
    borderColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },

  // Greeting Section
  greetingSection: {
    paddingHorizontal: SIZES.large,
    paddingTop: SIZES.medium,
  },
  greetingCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  greetingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  greetingTextContainer: {
    flex: 1,
  },
  greetingIconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  greetingText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  dateText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  storeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  storeStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  storeStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },

  // Alert Banner
  alertBanner: {
    marginHorizontal: SIZES.large,
    marginTop: SIZES.medium,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  alertTextContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  alertDescription: {
    fontSize: 12,
    color: '#B45309',
  },

  // Section
  section: {
    padding: SIZES.large,
    paddingBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.medium,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  seeAll: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Stats Grid
  statsGrid: {
    gap: 12,
  },
  primaryStatCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  primaryStatContent: {
    flex: 1,
    marginLeft: 12,
  },
  statTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCardSmall: {
    flex: 1,
    padding: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    ...SHADOWS.small,
  },
  statIconObj: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconObjSecondary: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: "center",
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
    textAlign: "center"
  },
  statLabelPrimary: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 22,
    includeFontPadding: false,
  },
  statValuePrimary: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginTop: 2,
  },
  statFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statChangePrimary: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },

  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: SIZES.small,
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    ...SHADOWS.medium,
    gap: 8,
  },
  actionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryAction: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryIconBg: {
    backgroundColor: COLORS.primary + '15',
  },
  secondaryActionLabel: {
    color: COLORS.textPrimary,
  },

  // Top Selling Items
  topItemsContainer: {
    gap: 10,
  },
  topItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 12,
    gap: 12,
    ...SHADOWS.small,
  },
  topItemRank: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topItemRankText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  topItemInfo: {
    flex: 1,
  },
  topItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  topItemQty: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Recent Orders
  recentOrdersContainer: {
    gap: 10,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 12,
    ...SHADOWS.small,
  },
  orderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderId: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  orderTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  orderRight: {
    alignItems: 'flex-end',
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  orderStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  orderStatusText: {
    fontSize: 11,
    color: COLORS.success,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 12,
  },

  // Menu Grid
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: SIZES.small,
  },

  menuItem: {
    width: '23%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
    padding: 8,
    marginBottom: 12,
  },

  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    // marginBottom: 6,
    // marginHorizontal: 6,
  },
  menuLabel: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    color: COLORS.textPrimary,
    letterSpacing: 0.1,
    paddingHorizontal: 4,
    marginTop: 6
  },
});

export default HomeScreen;
