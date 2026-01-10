import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, SIZES, SHADOWS } from '../styles/theme';
import Header from '../components/Header';
import StorageService from '../services/StorageService';
import { formatCurrency } from '../utils/helpers';
import { Order, RootTabParamList } from '../types';

/* ================= TYPES ================= */

type OrdersScreenNavigationProp =
  BottomTabNavigationProp<RootTabParamList, 'OrdersTab'>;

interface OrdersScreenProps {
  navigation: OrdersScreenNavigationProp;
}

/* ✅ COLUMN WIDTHS */
const COL_QTY = 50;
const COL_RATE = 65;
const COL_AMOUNT = 75;

const OrdersScreen: React.FC<OrdersScreenProps> = ({ navigation }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('TODAY');
  const [isFiltering, setIsFiltering] = useState(false);
  const [displayedOrders, setDisplayedOrders] = useState<Order[]>([]);

  /* ================= LOAD ORDERS ================= */

  const loadOrders = async () => {
    setLoading(true);
    const data = await StorageService.getOrders();
    setOrders(data);
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, []),
  );

  /* ================= FILTER LOGIC ================= */

  // if (historyFilter === 'ALL') {
  //   return [...orders].sort(
  //     (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  //   );
  // }

  const getOrderCounts = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.setDate(now.getDate() - 7)).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return {
      today: orders.filter(o => new Date(o.date).getTime() >= startOfDay).length,
      week: orders.filter(o => new Date(o.date).getTime() >= startOfWeek).length,
      month: orders.filter(o => new Date(o.date).getTime() >= startOfMonth).length,
      all: orders.length,
    };
  }, [orders]);

  useEffect(() => {
    setIsFiltering(true);

    // Simulate a small delay for feedback
    const timer = setTimeout(() => {
      let result = [...orders];
      const now = new Date();

      if (historyFilter === 'TODAY') {
        const today = new Date().toDateString();
        result = orders.filter(o => new Date(o.date).toDateString() === today);
      } else if (historyFilter === 'WEEK') {
        const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
        result = orders.filter(o => new Date(o.date).getTime() >= weekAgo);
      } else if (historyFilter === 'MONTH') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        result = orders.filter(o => new Date(o.date).getTime() >= monthStart);
      }

      setDisplayedOrders(result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setIsFiltering(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [orders, historyFilter]);


  /* ================= HELPERS ================= */

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId(prev => (prev === orderId ? null : orderId));
  };

  const formatTimeAMPM = (dateStr: string) => {
    const d = new Date(dateStr);
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h.toString().padStart(2, '0')}:${m} ${ap}`;
  };

  /* ================= RENDER ITEM ================= */

  const renderOrderItem = ({ item }: { item: Order }) => {
    const isExpanded = expandedOrderId === item.id;

    return (
      <View style={styles.orderCard}>
        {/* HEADER */}
        <View style={styles.orderHeader}>
          <View style={styles.orderIconBg}>
            <Icon name="receipt" size={20} color={COLORS.primary} />
          </View>

          <View style={styles.orderInfo}>
            <Text style={styles.orderId}>Order #{item.id?.slice(-6)}</Text>
            <Text style={styles.orderDate}>
              {formatTimeAMPM(item.date)} -{' '}
              {new Date(item.date).toLocaleDateString()}
            </Text>
          </View>

          <View style={styles.amountContainer}>
            <Text style={styles.totalAmount}>
              {formatCurrency(item.total)}
            </Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>Paid</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.detailsLink}
          onPress={() => toggleExpand(item.id!)}
        >
          <Text style={styles.detailsLinkText}>
            {isExpanded ? 'Hide Details' : 'View Details'}
          </Text>
          <Icon
            name={isExpanded ? 'chevron-up' : 'chevron-right'}
            size={16}
            color={COLORS.primary}
          />
        </TouchableOpacity>

        {/* EXPANDED */}
        {isExpanded && (
          <View style={styles.detailsContainer}>
            {/* TABLE HEADER */}
            <View style={styles.row}>
              <Text style={styles.colItemHeader}>Item</Text>
              <Text style={styles.colQtyHeader}>Qty</Text>
              <Text style={styles.colRateHeader}>Rate</Text>
              <Text style={styles.colAmountHeader}>Amount</Text>
            </View>

            <View style={styles.itemHeaderDivider} />

            {/* ITEMS */}
            {item.items?.map(it => (
              <View key={it.name} style={styles.row}>
                <Text style={styles.colItem}>{it.name}</Text>
                <Text style={styles.colQty}>{it.qty}</Text>
                <Text style={styles.colRate}>
                  {formatCurrency(it.price || 0)}
                </Text>
                <Text style={styles.colAmount}>
                  {formatCurrency((it.qty || 0) * (it.price || 0))}
                </Text>
              </View>
            ))}

            <View style={styles.detailRow}>
              <Text style={styles.detailName}>Payment Type</Text>
              <Text style={styles.detailAmount}>
                {item.payment || 'Cash'}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  /* ================= UI ================= */

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Icon
        name={historyFilter === 'TODAY' ? 'calendar-blank' : 'history'}
        size={48}
        color={COLORS.border}
        style={{ marginBottom: 12 }}
      />
      <Text style={styles.emptyStateTitle}>
        {historyFilter === 'TODAY' ? 'No Orders Today' : 'No Orders Yet'}
      </Text>
      <Text style={styles.emptyStateSubtitle}>
        {historyFilter === 'TODAY'
          ? 'Orders placed today will appear here'
          : 'Orders will appear in your history'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Orders" icon="receipt" subtitle="Transaction History" />

      {/* FILTER SECTION */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
          keyboardShouldPersistTaps="handled"
        >
          {[
            { id: 'TODAY', label: 'Today', count: getOrderCounts.today },
            { id: 'WEEK', label: 'Weekly', count: getOrderCounts.week },
            { id: 'MONTH', label: 'Monthly', count: getOrderCounts.month },
            { id: 'ALL', label: 'All History', count: getOrderCounts.all },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.filterTab,
                historyFilter === tab.id && styles.filterTabActive,
              ]}
              onPress={() => setHistoryFilter(tab.id as any)}
              activeOpacity={0.7}
              disabled={isFiltering}
            >
              <Text
                style={[
                  styles.filterLabel,
                  historyFilter === tab.id && styles.filterLabelActive,
                ]}
              >
                {tab.label}
              </Text>
              <View style={[
                styles.countBadge,
                historyFilter === tab.id ? styles.countBadgeActive : styles.countBadgeInactive
              ]}>
                <Text style={[
                  styles.countText,
                  historyFilter === tab.id && styles.countTextActive
                ]}>
                  {tab.count}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isFiltering ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          {/* <Text style={styles.loaderText}>loading...</Text> */}
        </View>
      ) : (
        <FlatList
          data={displayedOrders}
          renderItem={renderOrderItem}
          keyExtractor={i => i.id!}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadOrders} />
          }
          scrollEnabled={true}
          showsVerticalScrollIndicator={true}
        />
      )}
    </SafeAreaView>
  );
};

export default OrdersScreen;

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  filterSection: {
    paddingHorizontal: SIZES.medium,
    paddingVertical: SIZES.medium,
    backgroundColor: COLORS.background,
  },


  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 24,
  },

  filterTabActive: {
    backgroundColor: COLORS.primary,
  },

  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  filterLabelActive: {
    color: '#FFF',
  },

  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  countBadgeInactive: {
    backgroundColor: COLORS.border + '50',
  },

  countBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  countText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },

  countTextActive: {
    color: '#FFF',
  },

  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: SIZES.medium,
  },

  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  loaderText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },

  listContent: {
    paddingHorizontal: SIZES.medium,
    paddingVertical: SIZES.medium,
    paddingBottom: SIZES.large,
  },

  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
    paddingHorizontal: SIZES.medium,
  },

  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },

  emptyStateSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  orderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },

  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  orderIconBg: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  orderInfo: {
    flex: 1,
  },

  orderId: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  orderDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  amountContainer: {
    alignItems: 'flex-end',
  },

  totalAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },

  statusPill: {
    backgroundColor: COLORS.success + '15',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 0.5,
    borderColor: COLORS.success + '30',
  },

  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.success,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },

  detailsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  detailsLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },

  detailsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  row: {
    flexDirection: 'row',
    paddingVertical: 8,
  },

  colItem: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  colQty: {
    width: COL_QTY,
    textAlign: 'right',
    fontSize: 13,
  },
  colRate: {
    width: COL_RATE,
    textAlign: 'right',
    fontSize: 13,
  },
  colAmount: {
    width: COL_AMOUNT,
    textAlign: 'right',
    fontWeight: '600',
    fontSize: 13,
    color: COLORS.textPrimary,
  },

  colItemHeader: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  colQtyHeader: {
    width: COL_QTY,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  colRateHeader: {
    width: COL_RATE,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  colAmountHeader: {
    width: COL_AMOUNT,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },

  itemHeaderDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  detailName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  detailAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});

