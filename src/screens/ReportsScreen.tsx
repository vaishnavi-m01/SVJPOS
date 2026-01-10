import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  Modal,
  Platform,
  PermissionsAndroid,
  ToastAndroid,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, SIZES, SHADOWS } from '../styles/theme';
import Header from '../components/Header';
import Card from '../components/Card';
import StorageService from '../services/StorageService';
import PrinterService from '../services/PrinterService';
import { formatCurrency } from '../utils/helpers';
import { Order, RootTabParamList } from '../types';

type ReportsScreenNavigationProp = BottomTabNavigationProp<RootTabParamList, 'ReportsTab'>;

interface ReportsScreenProps {
  navigation: ReportsScreenNavigationProp;
}

const ReportsScreen: React.FC<ReportsScreenProps> = ({ navigation }) => {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalOrders: 0,
    averageOrder: 0,
  });
  const [range, setRange] = useState<'day' | 'week' | 'month'>('day');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [productSales, setProductSales] = useState<{ name: string; qty: number; total: number }[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewText, setPreviewText] = useState('');

  // Printing State
  const [isPrinting, setIsPrinting] = useState(false);
  const [showBluetoothModal, setShowBluetoothModal] = useState(false);
  const [isEnablingBluetooth, setIsEnablingBluetooth] = useState(false);

  const loadStats = useCallback(async () => {
    let orders = await StorageService.getOrders();
    const now = new Date();

    // Calculate Date Boundaries
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Filter by Date Range
    orders = orders.filter(order => {
      const orderDate = new Date(order.date);
      if (range === 'day') {
        return orderDate >= startOfDay;
      } else if (range === 'week') {
        return orderDate >= startOfWeek;
      } else if (range === 'month') {
        return orderDate >= startOfMonth;
      }
      return true;
    });

    if (paymentFilter !== 'all') {
      orders = orders.filter(o => o.payment === paymentFilter);
    }

    // Calculate Summary Stats
    const totalSales = orders.reduce((acc, curr) => acc + curr.total, 0);
    const totalOrders = orders.length;
    const averageOrder = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Calculate COGS and Expenses
    let expenses = await StorageService.getExpenses();
    expenses = expenses.filter(exp => {
      const expDate = new Date(exp.date);
      if (range === 'day') return expDate >= startOfDay;
      if (range === 'week') return expDate >= startOfWeek;
      if (range === 'month') return expDate >= startOfMonth;
      return true;
    });

    setStats({
      totalSales,
      totalOrders,
      averageOrder,
    });

    // Calculate Product Wise Sales
    const productMap: Record<string, { qty: number; total: number }> = {};

    orders.forEach(order => {
      order.items.forEach(item => {
        if (!productMap[item.name]) {
          productMap[item.name] = { qty: 0, total: 0 };
        }
        productMap[item.name].qty += item.qty;
        productMap[item.name].total += (item.qty * (item.price || 0));
      });
    });

    const sortedProducts = Object.entries(productMap)
      .map(([name, data]) => ({ name, qty: data.qty, total: data.total }))
      .sort((a, b) => b.total - a.total);

    setProductSales(sortedProducts);
  }, [range, paymentFilter]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats]),
  );

  const getReportData = () => {
    const title = range === 'day' ? "Today's Report" : range === 'week' ? "Weekly Report" : "Monthly Report";
    return {
      title,
      dateRange: new Date().toLocaleDateString(),
      stats,
      items: productSales
    };
  };

  const handlePreview = async () => {
    const data = getReportData();
    const printerSize = await PrinterService.getPrinterSize(); // Use a helper in service
    const cleanText = PrinterService.generateReportString(data, printerSize, true);

    setPreviewText(cleanText);
    setPreviewVisible(true);
  };

  const ensurePrinterConnected = async () => {
    const savedAddress = await AsyncStorage.getItem('PRINTER_ADDRESS');
    if (!savedAddress) return false;
    return await PrinterService.connectPrinter(savedAddress);
  };

  const handlePrint = async () => {
    if (isPrinting) return;
    setIsPrinting(true);

    try {
      // 1. Permission check
      const permissionGranted = await PrinterService.requestPermissions();
      if (!permissionGranted) {
        Alert.alert('Permission Required', 'Bluetooth permission is required to print');
        setIsPrinting(false);
        return;
      }

      // 2. Bluetooth check
      const bluetoothEnabled = await PrinterService.isBluetoothEnabled();
      if (!bluetoothEnabled) {
        setIsPrinting(false);
        setShowBluetoothModal(true);
        return;
      }

      // 3. Printer connection
      const connected = await ensurePrinterConnected();
      if (!connected) {
        // Double check if Bluetooth is still on
        const stillEnabled = await PrinterService.isBluetoothEnabled();
        if (!stillEnabled) {
          setIsPrinting(false);
          ToastAndroid.show('Please enable Bluetooth to print', ToastAndroid.SHORT);
          return;
        }

        Alert.alert(
          'Printer Not Connected',
          'Please connect your printer first',
          [
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        setIsPrinting(false);
        return;
      }

      // 4. Print
      const data = getReportData();
      const success = await PrinterService.printReport(data);

      if (success) {
        Alert.alert('Success', 'Report sent to printer');
      } else {
        Alert.alert('Print Error', 'Failed to send report to printer');
      }

    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsPrinting(false);
    }
  };

  const StatCard = ({ title, value, icon, color }: { title: string, value: string, icon: string, color: string }) => (
    <Card style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Icon name={icon} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="Reports"
        icon="chart-bar"
        subtitle="Sales Analytics"
      />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>

        {/* Payment Filter */}
        <View style={styles.filterContainer}>
          {['all', 'cash', 'card', 'upi', 'other'].map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.filterTab,
                paymentFilter === item && styles.activeFilterTab,
              ]}
              onPress={() => setPaymentFilter(item)}>
              <Text
                style={[
                  styles.filterText,
                  paymentFilter === item && styles.activeFilterText,
                ]}>
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Overview Cards */}
        <View style={styles.statsRow}>
          <StatCard
            title="Total Sales"
            value={formatCurrency(stats.totalSales)}
            icon="cash-multiple"
            color={COLORS.primary}
          />
          <StatCard
            title="Orders"
            value={stats.totalOrders.toString()}
            icon="receipt"
            color={COLORS.accent}
          />
        </View>

        {/* Product Wise Sales */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.sectionTitle}>Product Wise Sales</Text>
            {/* Date Filter moved here */}
            <View style={styles.miniFilterContainer}>
              {['day', 'week', 'month'].map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.miniFilterTab,
                    range === item && styles.activeMiniFilterTab,
                  ]}
                  onPress={() => setRange(item as any)}>
                  <Text
                    style={[
                      styles.miniFilterText,
                      range === item && styles.activeMiniFilterText,
                    ]}>
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Card style={styles.chartCard}>
            {/* Table Header */}
            <View style={[styles.productRow, { borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 8, marginBottom: 8 }]}>
              <View style={styles.productInfo}>
                <Text style={[styles.productName, { color: COLORS.textSecondary, fontSize: 12 }]}>PRODUCT</Text>
              </View>
              <View style={styles.productStats}>
                <Text style={[styles.productQty, { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' }]}>QTY</Text>
                <Text style={[styles.productTotal, { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' }]}>AMOUNT</Text>
              </View>
            </View>

            {productSales.length > 0 ? (
              productSales.map((item, index) => (
                <View key={index} style={styles.productRow}>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{item.name}</Text>
                  </View>
                  <View style={[styles.productStats, { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }]}>
                    <Text style={styles.productQty}>{item.qty}</Text>
                    <Text style={[styles.productTotal, { textAlign: 'right' }]}>{formatCurrency(item.total)}</Text>
                  </View>

                </View>
              ))
            ) : (
              <Text style={{ textAlign: 'center', color: COLORS.textSecondary, padding: 20 }}>No sales data for this period</Text>
            )}

            {/* Actions: Print and Preview */}
            {productSales.length > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 12 }}>

                {/* Preview Button */}
                <TouchableOpacity
                  style={[styles.bottomPrintBtn, { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border }]}
                  onPress={handlePreview}
                >
                  <Icon name="file-document-outline" size={18} color={COLORS.textPrimary} />
                  <Text style={[styles.bottomPrintBtnText, { color: COLORS.textPrimary }]}>Preview Bill</Text>
                </TouchableOpacity>

                {/* Print Button */}
                <TouchableOpacity
                  style={[styles.bottomPrintBtn, isPrinting && styles.disabledBtn]}
                  onPress={handlePrint}
                  disabled={isPrinting}
                >
                  <Icon name="printer" size={18} color="#fff" />
                  <Text style={styles.bottomPrintBtnText}>
                    {isPrinting ? 'Processing...' : 'Print Report'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        </View>
      </ScrollView>

      {/* Preview Modal */}
      <Modal visible={previewVisible} animationType="slide" transparent={false}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' }}>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>Report Preview</Text>
            <TouchableOpacity onPress={() => setPreviewVisible(false)}>
              <Icon name="close" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ backgroundColor: '#fff', margin: 16, padding: 10, borderRadius: 8, elevation: 2 }}>
            <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#000' }}>
              {(() => {
                let boldState = false;
                return previewText.split(/(\[B\]|\[\/B\])/).map((segment, index) => {
                  if (segment === '[B]') { boldState = true; return null; }
                  if (segment === '[/B]') { boldState = false; return null; }
                  return (
                    <Text key={index} style={{ fontWeight: boldState ? 'bold' : 'normal' }}>
                      {segment}
                    </Text>
                  );
                });
              })()}
            </Text>
          </ScrollView>

          <View style={{ padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' }}>
            <TouchableOpacity
              style={[styles.bottomPrintBtn, { justifyContent: 'center' }, isPrinting && styles.disabledBtn]}
              onPress={() => {
                setPreviewVisible(false);
                handlePrint();
              }}
              disabled={isPrinting}
            >
              <Icon name="printer" size={20} color="#fff" />
              <Text style={[styles.bottomPrintBtnText, { fontSize: 16 }]}>
                {isPrinting ? 'Processing...' : 'Print Report'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Custom Bluetooth Enable Modal */}
      <Modal
        visible={showBluetoothModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowBluetoothModal(false)}
      >
        <View style={styles.bluetoothModalOverlay}>
          <View style={styles.bluetoothDialog}>
            <View style={styles.bluetoothDialogHeader}>
              <Icon name="bluetooth" size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.bluetoothDialogTitle}>
              "SVJPOS" wants to turn on Bluetooth
            </Text>
            <View style={styles.bluetoothDialogButtons}>
              <TouchableOpacity
                style={[styles.bluetoothDialogButton, styles.bluetoothDialogButtonCancel]}
                onPress={() => {
                  setShowBluetoothModal(false);
                  setIsPrinting(false);
                }}
                disabled={isEnablingBluetooth}
              >
                <Text style={styles.bluetoothDialogButtonTextCancel}>Deny</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bluetoothDialogButton, styles.bluetoothDialogButtonAllow]}
                onPress={async () => {
                  setShowBluetoothModal(false);
                  await new Promise<void>(resolve => setTimeout(() => resolve(), 100));

                  setIsEnablingBluetooth(true);
                  const success = await PrinterService.enableBluetooth();
                  setIsEnablingBluetooth(false);

                  if (success) {
                    const nowEnabled = await PrinterService.waitForBluetooth(8000);
                    if (nowEnabled) {
                      ToastAndroid.show('Bluetooth enabled! Printing...', ToastAndroid.SHORT);
                      setTimeout(() => handlePrint(), 500);
                    } else {
                      ToastAndroid.show('Bluetooth took too long to turn on', ToastAndroid.LONG);
                    }
                  } else {
                    Alert.alert('Enable Bluetooth', 'Please turn on Bluetooth from settings.');
                  }
                }}
                disabled={isEnablingBluetooth}
              >
                <Text style={styles.bluetoothDialogButtonTextAllow}>
                  {isEnablingBluetooth ? 'Enabling...' : 'Allow'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingBottom: 10
  },
  content: {
    flex: 1,
    padding: SIZES.large,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: 4,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.large,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: SIZES.radius - 4,
  },
  activeFilterTab: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  activeFilterText: {
    color: '#fff',
  },
  // Mini Filter Styles for Header
  miniFilterContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  miniFilterTab: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  activeMiniFilterTab: {
    backgroundColor: COLORS.primary,
  },
  miniFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  activeMiniFilterText: {
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'flex-start',
    padding: 16,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  section: {
    marginTop: 12,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  chartCard: {
    padding: 16,
  },
  printBtn: {
    padding: 8,
  },
  // Product Row Styles
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  productStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  productQty: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
    width: 30,
    textAlign: 'right',
  },
  productTotal: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    width: 80,
    textAlign: 'right',
  },
  bottomPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  bottomPrintBtnText: {
    fontWeight: '600',
    color: "#fff"
  },
  disabledBtn: {
    opacity: 0.5,
  },

  // Custom Bluetooth Modal Styles
  bluetoothModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bluetoothDialog: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  bluetoothDialogHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  bluetoothDialogTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  bluetoothDialogButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  bluetoothDialogButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  bluetoothDialogButtonCancel: {
    backgroundColor: 'transparent',
  },
  bluetoothDialogButtonAllow: {
    backgroundColor: COLORS.primary,
  },
  bluetoothDialogButtonTextCancel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  bluetoothDialogButtonTextAllow: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ReportsScreen;

