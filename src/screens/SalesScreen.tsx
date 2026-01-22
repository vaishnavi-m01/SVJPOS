import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
  PermissionsAndroid,
  ToastAndroid,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera } from 'react-native-camera-kit';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES } from '../styles/theme';
import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import StorageService from '../services/StorageService';
import PrinterService from '../services/PrinterService';
import { formatCurrency, generateOrderNumber } from '../utils/helpers';
import { RootStackParamList } from '../types';
import { Item, CartItem, Order, Category } from '../types';
import { buildReceipt } from '../utils/PrinterPreview';
import RBSheet from 'react-native-raw-bottom-sheet';

type SalesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Sales'>;

interface SalesScreenProps {
  navigation: SalesScreenNavigationProp;
}

const SalesScreen: React.FC<SalesScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const rbSheetRef = useRef<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [quantity, setQuantity] = useState<string>('1');
  const [rate, setRate] = useState<string>('0');
  const [isScanning, setIsScanning] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [paymentType, setPaymentType] = useState<string>('cash');
  const paymentTypes = ['cash', 'card', 'upi', 'other'];
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editRate, setEditRate] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [showBluetoothAlert, setShowBluetoothAlert] = useState(false);
  const [showBluetoothModal, setShowBluetoothModal] = useState(false);
  const [isEnablingBluetooth, setIsEnablingBluetooth] = useState(false);


  // Category Filtering
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // GST Summary State
  const [taxes, setTaxes] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadTaxes();
    }, [])
  );

  const loadTaxes = async () => {
    const taxesData = await StorageService.getTaxes();
    setTaxes(taxesData);
  };

  const loadData = async () => {
    const [itemsData, categoriesData] = await Promise.all([
      StorageService.getItems(),
      StorageService.getCategories(),
    ]);
    setItems(itemsData);
    setCategories(categoriesData);
  };


  // // Vision Camera Setup
  // const device = useCameraDevice('back');
  // const codeScanner = useCodeScanner({
  //   codeTypes: ['ean-13', 'ean-8'],
  //   onCodeScanned: (codes) => {
  //     if (codes.length > 0) {
  //       const value = codes[0].value;
  //       if (value) handleCodeScanned(value);
  //     }
  //   }
  // });

  const handleCodeScanned = (scannedCode: string) => {
    // Prevent duplicate scans if needed, or debounce
    // For now, just call the logic
    console.log(`Scanned: ${scannedCode}`);

    // Block IMEI (15 digits)
    if (scannedCode.length === 15) {
      ToastAndroid.show('IMEI code not allowed', ToastAndroid.SHORT);
      return;
    }

    if (scannedCode.length !== 8 && scannedCode.length !== 13) {
      ToastAndroid.show('Only EAN barcode allowed (Scanned: ' + scannedCode.length + ')', ToastAndroid.SHORT);
      // return; // Vision camera might scan other types if not filtered, but we filtered in useCodeScanner
    }

    setIsScanning(false);
    const cleanCode = scannedCode.replace(/\s/g, '');
    const item = items.find(
      i => i.code?.replace(/\s/g, '') === cleanCode || i.barcode?.replace(/\s/g, '') === cleanCode
    );

    if (item) {
      handleAddToCart(item);
      ToastAndroid.show('Item added: ' + item.name, ToastAndroid.SHORT);
    } else {
      Alert.alert('Not Found', 'No item found with this EAN barcode');
    }
  };


  const handleScanPress = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA
      );

      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission Denied', 'Camera permission is required');
        return;
      }
    }

    setIsScanning(true);
  };


  const handleAddToCart = (item: Item, qty: number = 1, price?: number) => {
    if (!item) return;

    const finalPrice = price ?? item.price;
    if (qty <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    const existingIndex = cart.findIndex(i => i.id === item.id);
    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += qty;
      setCart(newCart);
    } else {
      setCart([{ ...item, quantity: qty, price: finalPrice }, ...cart]);
    }

    // Reset selected item if it was this item
    if (selectedItem?.id === item.id) {
      setSelectedItem(null);
      setQuantity('1');
      setRate('0');
    }
  };

  const addToCart = () => {
    if (!selectedItem) return;

    const qty = parseFloat(quantity);
    const price = parseFloat(rate);

    if (qty <= 0 || price <= 0) {
      Alert.alert('Error', 'Please enter valid quantity and rate');
      return;
    }

    handleAddToCart(selectedItem, qty, price);
  };



  const removeFromCart = (index: number) => {
    const newCart = cart.filter((_, i) => i !== index);
    setCart(newCart);
  };

  const updateCartQty = (index: number, delta: number) => {
    const newCart = [...cart];
    const item = newCart[index];

    // Calculate new quantity
    const newQty = item.quantity + delta;

    // Find original item stock
    const originalItem = items.find(i => i.id === item.id);
    const stock = originalItem?.stock ?? Infinity;

    // if (newQty > stock) {
    //   Alert.alert('Out of Stock', `${item.name} only has ${stock} in stock`);
    //   return;
    // }

    if (newQty <= 0) {
      removeFromCart(index);
    } else {
      item.quantity = newQty;
      setCart(newCart);
    }
  };


  const openEditModal = (index: number) => {
    setEditingItemIndex(index);
    setEditQty(cart[index].quantity.toString());
    setEditRate((cart[index].rate ?? cart[index].price).toString());
    setEditModalVisible(true);
  };

  const saveEditValue = () => {
    if (editingItemIndex === null) return;
    const qty = parseFloat(editQty);
    const rate = parseFloat(editRate);
    if (qty > 0 && rate >= 0) {
      const newCart = [...cart];
      newCart[editingItemIndex].quantity = qty;
      newCart[editingItemIndex].rate = rate;
      newCart[editingItemIndex].price = rate;
      setCart(newCart);
    }
    setEditModalVisible(false);
    setEditingItemIndex(null);
  };

  const calculateTotal = () => {
    let subtotal = 0;
    let totalTax = 0;

    const taxMap: {
      [perc: number]: { taxable: number; sgst: number; cgst: number };
    } = {};

    cart.forEach(item => {
      const qty = item.quantity;
      const rate = item.rate ?? item.price;
      const lineTotal = qty * rate;

      const taxObj =
        taxes.find(t => t.id === item.taxId) ||
        taxes.find(t => t.isDefault) ||
        { rate: 0 };

      const perc = taxObj.rate || 0;

      // ✅ EXCLUSIVE GST
      if (perc > 0) {
        const taxable = lineTotal;
        const sgst = taxable * (perc / 2) / 100;
        const cgst = taxable * (perc / 2) / 100;

        subtotal += taxable;
        totalTax += sgst + cgst;

        if (!taxMap[perc]) {
          taxMap[perc] = { taxable: 0, sgst: 0, cgst: 0 };
        }

        taxMap[perc].taxable += taxable;
        taxMap[perc].sgst += sgst;
        taxMap[perc].cgst += cgst;
      }
      // ✅ INCLUSIVE / NO GST
      else {
        subtotal += lineTotal;

        if (!taxMap[0]) {
          taxMap[0] = { taxable: 0, sgst: 0, cgst: 0 };
        }

        taxMap[0].taxable += lineTotal;
      }
    });

    const gstSummary = Object.keys(taxMap).map(k => {
      const perc = Number(k);
      const row = taxMap[perc];
      return {
        perc,
        taxable: row.taxable,
        sgst: row.sgst,
        cgst: row.cgst,
        total: row.sgst + row.cgst,
      };
    });

    const total = Math.round(Number(subtotal) + Number(totalTax));


    return { subtotal, tax: totalTax, total, gstSummary };
  };


  const ensurePrinterConnected = async () => {
    const savedAddress = await AsyncStorage.getItem('PRINTER_ADDRESS');
    console.log("SavedAddress", savedAddress)
    if (!savedAddress) return false;

    return await PrinterService.connectPrinter(savedAddress);
  };


  const handleSelectPrinter = async (device: any) => {
    console.log('Connecting to:', device.name, device.address);

    if (!device.address) {
      Alert.alert('Error', 'Invalid printer address');
      return;
    }

    const connected = await PrinterService.connectPrinter(
      device.address.trim()
    );

    if (connected) {
      await AsyncStorage.setItem(
        'PRINTER_ADDRESS',
        device.address.trim()
      );
      ToastAndroid.show(
        `${device.name} connected successfully`,
        ToastAndroid.SHORT
      );
      setShowPrinterModal(false);
    } else {
      Alert.alert('Failed', 'Printer connection failed');
    }
  };


  const handlePrint = async () => {
    if (isPrinting) return;
    console.log(' handlePrint started');
    setIsPrinting(true);

    try {
      // 1. Cart check
      if (cart.length === 0) {
        console.log(' Cart is empty');
        return;
      }
      console.log(' Cart items:', cart.length);

      // 2️⃣ Permission check
      console.log(' Requesting printer permissions...');
      const permissionGranted = await PrinterService.requestPermissions();
      console.log(' Permission result:', permissionGranted);

      // if (!permissionGranted) {
      //   console.log('❌ Printer permission denied');
      //   Alert.alert(
      //     'Permission Required',
      //     'Bluetooth permission is required to print'
      //   );
      //   return;
      // }

      // 3️⃣ Bluetooth check
      console.log('🔵 Checking Bluetooth status via PrinterService...');
      const bluetoothEnabled = await PrinterService.isBluetoothEnabled();
      console.log('🔵 Bluetooth check result:', bluetoothEnabled);

      if (!bluetoothEnabled) {
        console.log('❌ Bluetooth is OFF');
        // Show custom modal instead of system dialog
        setIsPrinting(false);
        setShowBluetoothModal(true);
        return;
      }

      // 4️⃣ Printer connection
      console.log('🔵 Ensuring printer connection...');
      const isAlreadyConnected = await PrinterService.isPrinterConnected();
      if (!isAlreadyConnected) {
        ToastAndroid.show("Auto-connecting to printer...", ToastAndroid.SHORT);
      }
      const connected = await ensurePrinterConnected();
      console.log(' Printer connected:', connected);

      if (!connected) {

        console.log(' Printer not connected');
        // Check if it's because Bluetooth is off
        const stillEnabled = await PrinterService.isBluetoothEnabled();
        if (!stillEnabled) {
          // Reset printing state immediately
          setIsPrinting(false);

          ToastAndroid.show('Please enable Bluetooth to print', ToastAndroid.SHORT);

          // Trigger Bluetooth enable in background
          PrinterService.enableBluetooth().then(async (success) => {
            if (success) {
              const nowEnabled = await PrinterService.waitForBluetooth(8000);
              if (nowEnabled) {
                ToastAndroid.show('Bluetooth enabled! Please try printing again.', ToastAndroid.LONG);
              } else {
                ToastAndroid.show('Bluetooth took too long to turn on.', ToastAndroid.LONG);
              }
            } else {
              ToastAndroid.show('Please enable Bluetooth manually', ToastAndroid.LONG);
            }
          });
          return;
        }

        Alert.alert(
          'Printer Disconnected',
          'Could Not Connect to the Printer. Please Turn It On and Try Again.',
          [
            { text: 'OK', style: 'default' },
            {
              text: 'Settings',
              onPress: () => navigation.navigate('Printer'),
              style: 'cancel'
            },
          ]
        );
        return;
      }

      // 5️⃣ Calculate totals
      console.log('🔵 Calculating totals...');
      const { subtotal, tax, total, gstSummary } = calculateTotal();
      console.log('📊 Totals:', { subtotal, tax, total, gstSummary });

      // 6️⃣ Prepare order object
      const order: Omit<Order, 'id'> = {
        orderNumber: generateOrderNumber(),
        date: new Date().toISOString(),
        items: cart.map(item => ({
          name: item.name,
          qty: item.quantity,
          price: item.price,
          purchasePrice: item.purchasePrice || 0,
          mrp: item.mrp ?? item.price,
          rate: item.rate ?? item.price,
          taxId: item.taxId,
        })),
        subtotal,
        tax,
        total,
        payment: paymentType,
        gstSummary,
      };

      console.log(' Order prepared:', order);

      // 7️⃣ Print receipt
      console.log(' Sending print command...');
      const printed = await PrinterService.printReceipt({
        ...order,
        id: '',
      });
      console.log(' Print result:', printed);

      if (printed) {
        //  Save order only after successful print
        console.log(' Saving order...');
        await StorageService.saveOrder(order);
        console.log(' Order saved successfully');

        ToastAndroid.show('Order printed and saved!', ToastAndroid.SHORT);

        // 9 Reset UI
        console.log(' Resetting screen state');
        setCart([]);
        setSelectedItem(null);
        setSearchQuery('');
        setPaymentType('cash');
        setPreviewVisible(false);

        console.log('[PrinterService] Print command sent successfully.');

        // Short delay after print to ensure buffer is cleared before we return "success"
        await new Promise(resolve => setTimeout(() => resolve(true), 500));

        console.log(' handlePrint completed successfully');
      } else {
        console.log(' Print failed');
        Alert.alert('Print Error', 'Failed to print receipt. Please check connection and try again.');
      }
    } catch (e: any) {
      console.error(' Print error:', e);
      Alert.alert('Error', 'An unexpected error occurred while printing.');
    } finally {
      setIsPrinting(false);
      console.log('🎉 handlePrint completed');
    }
  };



  // const handlePrint = async () => {
  //   if (cart.length === 0) return;

  //   const permissionGranted = await PrinterService.requestPermissions();
  //   if (!permissionGranted) {
  //     Alert.alert(
  //       'Permission Required',
  //       'Bluetooth permission is required to print'
  //     );
  //     return;
  //   }

  //   // ✅ CHECK IF BLUETOOTH IS ENABLED
  //   const bluetoothEnabled = await PrinterService.isBluetoothEnabled();
  //   if (!bluetoothEnabled) {
  //     Alert.alert(
  //       'Bluetooth is OFF',
  //       'Please turn on Bluetooth to print bills',
  //       [
  //         { text: 'OK', style: 'cancel' }
  //       ]
  //     );
  //     return;
  //   }

  //   //  Auto scan + connect happens here
  //   const connected = await ensurePrinterConnected();
  //   if (!connected) {
  //     Alert.alert(
  //       'Printer Not Connected',
  //       'Please connect your printer first',
  //       [
  //         { text: 'Cancel', style: 'cancel' },
  //         {
  //           text: 'Go to Printer Settings',
  //           onPress: () => navigation.navigate('Printer'),
  //         },
  //       ]
  //     );
  //     return;
  //   }



  //   try {
  //     // -------- Prepare order for printing --------
  //     const { subtotal, tax, total, gstSummary } = calculateTotal();
  //     const order: Omit<Order, 'id'> = {
  //       orderNumber: generateOrderNumber(),
  //       date: new Date().toISOString(),
  //       items: cart.map(item => ({
  //         name: item.name,
  //         qty: item.quantity,
  //         price: item.price,
  //         purchasePrice: item.purchasePrice || 0, // Store cost at sale time
  //         mrp: item.mrp ?? item.price,
  //         rate: item.rate ?? item.price,
  //         taxId: item.taxId,
  //       })),
  //       subtotal,
  //       tax,
  //       total,
  //       payment: paymentType,
  //       gstSummary,
  //     };


  //     // -------- Print --------
  //     const printed = await PrinterService.printReceipt({
  //       ...order,
  //       id: '',
  //     });

  //     if (printed) {
  //       // ✅ ONLY SAVE ORDER AFTER SUCCESSFUL PRINT
  //       await StorageService.saveOrder(order);
  //       ToastAndroid.show('Order printed and saved!', ToastAndroid.SHORT);

  //       // Reset screen for next sale
  //       setCart([]);
  //       setSelectedItem(null);
  //       setSearchQuery('');
  //       setPaymentType('cash');
  //       setPreviewVisible(false);
  //     } else {
  //       Alert.alert('Print Failed', 'Printer error. Please check Bluetooth connection and try again.');
  //     }
  //   } catch (err) {
  //     console.log('handlePrint error:', err);
  //     Alert.alert('Error', 'Something went wrong with printing');
  //   }
  // };



  const { subtotal, tax, total, gstSummary } = calculateTotal();
  console.log("taxes:", taxes);

  const COL = {
    perc: 50,
    taxable: 90,
    gst: 70,
    total: 100,
  };


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="New Sale"
        subtitle={`Invoice #${Date.now().toString().slice(-6)}`}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 50 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search */}
        <Card style={styles.searchCard}>
          <View style={styles.searchRow}>
            <View style={styles.searchInputContainer}>
              <Icon name="magnify" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or code..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Icon name="close" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.scanButton} onPress={handleScanPress}>
              <Icon name="barcode-scan" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Search Results */}
          {searchQuery.length > 0 && (
            <View style={styles.searchResults}>
              {items
                .filter(i =>
                  i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  i.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (i.barcode && i.barcode.includes(searchQuery))
                )
                .slice(0, 5)
                .map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.searchResultItem}
                    onPress={() => {
                      handleAddToCart(item);
                      setSearchQuery('');
                    }}
                  >
                    <Icon name="package-variant" size={20} color={COLORS.primary} />
                    <View style={styles.searchResultInfo}>
                      <Text style={styles.searchResultName}>{item.name}</Text>
                      <Text style={styles.searchResultCode}>{item.code}</Text>
                    </View>
                    <Text style={styles.searchResultPrice}>{formatCurrency(item.price)}</Text>
                  </TouchableOpacity>
                ))}
            </View>
          )}

          {/* Category Filter */}
          {categories.length > 0 && searchQuery.length === 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryFilterList}
              style={{ marginTop: 12 }}
              keyboardShouldPersistTaps="handled"
            >
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  selectedCategoryId === null && styles.filterChipSelected
                ]}
                onPress={() => setSelectedCategoryId(null)}
              >
                <Text style={[
                  styles.filterChipText,
                  selectedCategoryId === null && styles.filterChipTextSelected
                ]}>All</Text>
              </TouchableOpacity>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.filterChip,
                    selectedCategoryId === cat.id && styles.filterChipSelected
                  ]}
                  onPress={() => setSelectedCategoryId(cat.id)}
                >
                  <Text style={[
                    styles.filterChipText,
                    selectedCategoryId === cat.id && styles.filterChipTextSelected
                  ]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Quick Items / Category Items */}
          {searchQuery.length === 0 && (
            <View style={{ marginTop: 12 }}>
              <View style={styles.quickItemsHeader}>
                <Text style={styles.quickItemsTitle}>
                  {selectedCategoryId ? 'Items' : 'Popular Items'}
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4 }}
                keyboardShouldPersistTaps="handled"
              >
                {[...items]
                  .reverse()
                  .filter(i => !selectedCategoryId || i.categoryId === selectedCategoryId)
                  .slice(0, 4)
                  .map(item => (
                    <TouchableOpacity key={item.id} style={styles.quickItem} onPress={() => handleAddToCart(item)}>
                      <Text style={styles.quickItemText}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
                {items.filter(i => !selectedCategoryId || i.categoryId === selectedCategoryId).length > 4 && (
                  <TouchableOpacity
                    style={[styles.quickItem, styles.moreBtn]}
                    onPress={() => rbSheetRef.current?.open()}
                  >
                    <Text style={[styles.quickItemText, { color: COLORS.primary }]}>+ More</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          )}
        </Card>

        {/* More Items Bottom Sheet */}
        <RBSheet
          ref={rbSheetRef}
          draggable={true}
          closeOnPressMask={true}
          height={500}
          customStyles={{
            wrapper: { backgroundColor: 'rgba(0,0,0,0.5)' },
            draggableIcon: { backgroundColor: '#ddd', width: 60 },
            container: {
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              padding: 20,
              backgroundColor: '#fff',
            }
          }}
        >
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>All {selectedCategoryId ? 'Category' : 'Popular'} Items</Text>
            <TouchableOpacity onPress={() => rbSheetRef.current?.close()}>
              <Icon name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetGrid}
            keyboardShouldPersistTaps="handled"
          >
            {[...items]
              .reverse()
              .filter(i => !selectedCategoryId || i.categoryId === selectedCategoryId)
              .map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.sheetItem}
                  onPress={() => {
                    handleAddToCart(item);
                    rbSheetRef.current?.close();
                  }}
                >
                  <View style={styles.sheetItemIcon}>
                    <Icon name="package-variant" size={24} color={COLORS.primary} />
                  </View>
                  <Text style={styles.sheetItemName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.sheetItemPrice}>{formatCurrency(item.price)}</Text>
                </TouchableOpacity>
              ))}
          </ScrollView>
        </RBSheet>

        {/* Selected Item Details */}
        {selectedItem && (
          <Card style={styles.detailsCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.detailsTitle}>Item Details</Text>
              <TouchableOpacity onPress={() => setSelectedItem(null)}>
                <Icon name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.itemName}>{selectedItem.name}</Text>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  value={quantity}
                  keyboardType="numeric"
                  onChangeText={(text) => {
                    const qty = parseFloat(text) || 0;
                    const stock = selectedItem?.stock ?? Infinity;

                    // if (qty > stock) {
                    //   ToastAndroid.show(`Only ${stock} in stock`, ToastAndroid.SHORT);
                    //   return;
                    // }

                    setQuantity(text);
                  }}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Rate</Text>
                <TextInput
                  style={styles.input}
                  value={rate}
                  onChangeText={setRate}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={styles.amount}>{formatCurrency(parseFloat(quantity) * parseFloat(rate))}</Text>
            <Button title="Add to Cart" onPress={addToCart} />
          </Card>
        )}


        {/* Cart */}
        <Card style={styles.cartCard}>
          <Text style={styles.cartTitle}>Cart Items ({cart.length})</Text>
          {cart.length === 0 ? (
            <Text style={styles.emptyText}>No items added yet</Text>
          ) : (
            cart.map((item, index) => (
              <View key={index} style={styles.cartItemContainer}>
                <TouchableOpacity
                  style={styles.cartItemContent}
                  onPress={() => openEditModal(index)}
                >
                  <View style={styles.cartItemInfo}>
                    <Text style={styles.cartItemName} numberOfLines={1} >{item.name}</Text>
                    <View style={{ flexDirection: 'row', marginTop: 4 }}>
                      {/* Rate */}
                      <View style={{ flex: 1, minHeight: 20, justifyContent: 'center' }}>
                        <Text
                          style={styles.cartItemNote}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.8}
                        >
                          Rate: {formatCurrency(item.rate ?? item.price)}
                        </Text>
                      </View>

                      {/* MRP */}
                      <View style={{ flex: 1, minHeight: 20, justifyContent: 'center', marginLeft: 12 }}>
                        <Text
                          style={styles.cartItemNote}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.8}
                        >
                          MRP: {formatCurrency(item.mrp ?? item.price)}
                        </Text>
                      </View>
                    </View>

                  </View>
                  <View style={styles.cartItemPriceSection}>
                    <Text style={styles.cartItemTotal}>{formatCurrency(item.quantity * (item.rate ?? item.price))}</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.actionRow}>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity onPress={() => updateCartQty(index, -1)} style={styles.qtyBtn}>
                      <Icon name="minus" size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.qtyValue}
                      value={String(item.quantity)}
                      keyboardType="numeric"
                      onChangeText={(text) => {
                        const qty = parseFloat(text) || 0;

                        // Get original item stock
                        const originalItem = items.find(i => i.id === item.id);
                        const stock = originalItem?.stock ?? Infinity;

                        // if (qty > stock) {
                        //   Alert.alert('Out of Stock', `${item.name} only has ${stock} in stock`);
                        //   return;
                        // }

                        const newCart = [...cart];
                        newCart[index].quantity = qty;
                        setCart(newCart);
                      }}
                    />

                    <TouchableOpacity onPress={() => updateCartQty(index, 1)} style={styles.qtyBtn}>
                      <Icon name="plus" size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={() => removeFromCart(index)} style={styles.deleteBtn}>
                    <Icon name="delete-outline" size={20} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </Card>

        {/* Summary */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text>Subtotal</Text>
            <Text>{formatCurrency(subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Tax</Text>
            <Text>{formatCurrency(tax)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: 420 }}>
              {/* Header Row */}
              <View style={{ flexDirection: 'row', marginTop: 8, paddingHorizontal: 4 }}>
                <Text style={{ width: COL.perc, fontWeight: '600', fontSize: 13 }}>Perc</Text>
                <Text style={{ width: COL.taxable, fontWeight: '600', fontSize: 13, textAlign: 'right' }}>Taxable</Text>
                <Text style={{ width: COL.gst, fontWeight: '600', fontSize: 13, textAlign: 'right' }}>SGST</Text>
                <Text style={{ width: COL.gst, fontWeight: '600', fontSize: 13, textAlign: 'right' }}>CGST</Text>
                <Text style={{ width: COL.total, fontWeight: '600', fontSize: 13, textAlign: 'right' }}>GST Amt</Text>
              </View>


              {/* Rows */}
              {gstSummary.map((row, idx) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: 'row',
                    marginTop: 6,
                    borderTopWidth: 1,
                    borderTopColor: '#ddd',
                    paddingTop: 4,
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ width: COL.perc, fontSize: 12 }}>
                    {row.perc.toFixed(2)}%
                  </Text>

                  <Text style={[styles.amountFixed, { width: COL.taxable }]}>
                    {formatCurrency(row.taxable)}
                  </Text>

                  <Text style={[styles.amountFixed, { width: COL.gst }]}>
                    {formatCurrency(row.sgst)}
                  </Text>

                  <Text style={[styles.amountFixed, { width: COL.gst }]}>
                    {formatCurrency(row.cgst)}
                  </Text>

                  <Text style={[styles.amountFixed, { width: COL.total }]}>
                    {formatCurrency(row.total)}
                  </Text>

                </View>
              ))}

              {/* Total Row */}
              {/* GST Total Row (FIXED ALIGNMENT) */}
              <View
                style={{
                  flexDirection: 'row',
                  marginTop: 6,          // reduced
                  borderTopWidth: 1,
                  borderTopColor: '#ddd',
                  paddingTop: 4,         // reduced
                  paddingHorizontal: 4,
                }}
              >
                <Text style={{ width: COL.perc, fontWeight: '700', fontSize: 12 }}>
                  Total
                </Text>

                <Text style={[styles.amountFixed, { width: COL.taxable }]}>
                  {formatCurrency(gstSummary.reduce((a, b) => a + b.taxable, 0))}
                </Text>

                <Text style={[styles.amountFixed, { width: COL.gst }]}>
                  {formatCurrency(gstSummary.reduce((a, b) => a + b.sgst, 0))}
                </Text>

                <Text style={[styles.amountFixed, { width: COL.gst }]}>
                  {formatCurrency(gstSummary.reduce((a, b) => a + b.cgst, 0))}
                </Text>

                <Text
                  style={[
                    styles.amountFixed,
                    { width: COL.total, color: COLORS.primary, fontWeight: '700' },
                  ]}
                >
                  {formatCurrency(gstSummary.reduce((a, b) => a + b.total, 0))}
                </Text>
              </View>

            </View>
          </ScrollView>
        </Card>

        {/* Payment Method */}
        <Card style={styles.paymentCard}>
          <Text style={styles.paymentTitle}>Payment Method</Text>
          <View style={styles.paymentOptions}>
            {paymentTypes.map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.paymentOption, paymentType === type && styles.selectedPayment]}
                onPress={() => setPaymentType(type)}
              >
                <Text style={paymentType === type ? styles.selectedText : styles.paymentText}>{type.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

      </ScrollView>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Button
          title="Preview Bill"
          style={{ flex: 1, marginRight: 6 }}
          onPress={async () => {
            const { subtotal, tax, total, gstSummary } = calculateTotal();

            const order: Order = {
              id: '',
              orderNumber: generateOrderNumber(),
              date: new Date().toISOString(),
              items: cart.map(item => ({
                name: item.name,
                qty: item.quantity,
                price: item.price,
                mrp: item.mrp ?? item.price,
                rate: item.rate ?? item.price,
                taxId: item.taxId,
              })),
              subtotal,
              tax,
              total,
              payment: paymentType,
              gstSummary,
            };

            const printerSize = await AsyncStorage.getItem('printerSize') as any || '58mm';
            const store = await StorageService.getStoreDetails();
            const receipt = buildReceipt(order, printerSize, store, true);
            setPreviewText(receipt);
            setPreviewVisible(true);
          }}
        />

        {/* <Button title="Save Order" onPress={handleSave} disabled={cart.length === 0} style={{ flex: 1, marginRight: 6, backgroundColor: COLORS.success }} /> */}
        <Button
          title={isPrinting ? "Processing..." : "Print Bill"}
          onPress={handlePrint}
          disabled={cart.length === 0 ||
            isPrinting}
          style={{ flex: 1, marginLeft: 6 }}
        />
      </View>

      {/* Item Edit Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Item</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Icon name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 16 }}>
              <Text style={styles.itemNameLabel}>{editingItemIndex !== null ? cart[editingItemIndex].name : ''}</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  value={editQty}
                  onChangeText={setEditQty}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Rate (Each)</Text>
                <TextInput
                  style={styles.input}
                  value={editRate}
                  onChangeText={setEditRate}
                  keyboardType="numeric"
                  placeholder="0.00"
                />
              </View>

              <View style={{ marginTop: 24 }}>
                <Button title="Apply Changes" onPress={saveEditValue} />
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Barcode Scanner Modal */}
      <Modal visible={isScanning} transparent={true} animationType="slide" onRequestClose={() => setIsScanning(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.scannerHeader}>
              <Text style={styles.scannerTitle}>Scan Barcode</Text>
              <TouchableOpacity onPress={() => setIsScanning(false)} style={styles.closeButton}>
                <Icon name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <Camera
              style={{ flex: 1 }}
              scanBarcode={true}
              showFrame={true}
              laserColor="red"
              frameColor="white"
              onReadCode={(event: any) => {
                if (event?.nativeEvent?.codeStringValue) {
                  handleCodeScanned(event.nativeEvent.codeStringValue);
                }
              }}
            />
          </SafeAreaView>
        </View>
      </Modal>

      {/* Printer Modal */}
      <Modal
        visible={showPrinterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPrinterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPrinterModal(false)}
        >
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Select Printer</Text>

            {devices.length === 0 ? (
              <Text>No printers found</Text>
            ) : (
              devices.map(d => (
                <TouchableOpacity
                  key={d.address}
                  style={styles.modalButton}
                  onPress={() => handleSelectPrinter(d)}
                >
                  <Text>
                    {(d.name || 'Printer')} ({d.address || 'N/A'})
                  </Text>


                </TouchableOpacity>
              ))
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Print preview modal */}
      <Modal visible={previewVisible} transparent={true} animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#eee', marginTop: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ddd' }}>
              <Text style={{ fontSize: 18, fontWeight: '700' }}>Receipt Preview</Text>
              <TouchableOpacity onPress={() => setPreviewVisible(false)}>
                <Icon name="close" size={28} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ backgroundColor: '#fff', margin: 16, padding: 12, borderRadius: 8 }}
              showsVerticalScrollIndicator={false}
            >
              {previewText.split('\n').map((line, index) => {
                let text = line;
                let isBold = false;

                if (text.includes('[B]')) {
                  isBold = true;
                  text = text.replace('[B]', '');
                }
                if (text.includes('[/B]')) {
                  isBold = false;
                  text = text.replace('[/B]', '');
                }

                return (
                  <Text
                    key={index}
                    style={{
                      fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
                      fontSize: 12,
                      color: '#000',
                      lineHeight: 16,
                      fontWeight: isBold ? 'bold' : 'normal',
                    }}
                  >
                    {text}
                  </Text>
                );
              })}
            </ScrollView>

            <View style={{ padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#ddd' }}>
              <Button
                title={isPrinting ? "PROCESSING..." : "PRINT"}
                onPress={handlePrint}
                disabled={isPrinting}
              />
            </View>
          </SafeAreaView>
        </View>
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
                  // Close our custom modal FIRST
                  setShowBluetoothModal(false);

                  // Small delay to let modal close animation complete
                  await new Promise<void>(resolve => setTimeout(() => resolve(), 100));

                  // Now enable Bluetooth - system dialog will show with SalesScreen visible behind
                  setIsEnablingBluetooth(true);
                  const success = await PrinterService.enableBluetooth();
                  setIsEnablingBluetooth(false);

                  if (success) {
                    const nowEnabled = await PrinterService.waitForBluetooth(8000);
                    if (nowEnabled) {
                      ToastAndroid.show('Bluetooth enabled! Printing...', ToastAndroid.SHORT);
                      // Auto-retry print
                      setTimeout(() => handlePrint(), 500);
                    } else {
                      ToastAndroid.show('Bluetooth took too long to turn on', ToastAndroid.LONG);
                    }
                  } else {
                    Alert.alert(
                      'Enable Bluetooth',
                      'Please turn on Bluetooth from your device settings and try printing again.',
                      [{ text: 'OK', style: 'default' }]
                    );
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

// ------------------- Styles -------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: SIZES.large,
  },
  searchCard: {
    marginBottom: SIZES.medium,
    padding: 16,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  scanButton: {
    backgroundColor: COLORS.primary,
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  searchInput: {
    flex: 1,
    height: 48,
    marginLeft: 8,
    color: '#000',
  },
  searchResults: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  searchResultCode: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  searchResultPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  quickItemsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.primary + '10',
    borderRadius: 20,
    marginRight: 8,
  },
  quickItemText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  categoryFilterList: {
    gap: 10,
    paddingRight: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#eee',
  },
  filterChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  filterChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  detailsCard: {
    padding: 16,
    marginBottom: 16,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  amount: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  cartCard: {
    padding: 16,
    marginBottom: 16,
  },
  cartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  cartItemContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cartItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  cartItemNote: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  cartItemPriceSection: {
    alignItems: 'flex-end',
  },
  cartItemTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  amountText: {
    flex: 2,
    fontSize: 12,
    textAlign: 'right',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    includeFontPadding: false,
  },

  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 4,
  },
  qtyBtn: {
    padding: 6,
  },
  qtyValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    minWidth: 30,
    textAlign: 'center',
  },
  deleteBtn: {
    padding: 6,
    backgroundColor: '#fff1f0',
    borderRadius: 8,
  },
  summaryCard: {
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalRow: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  amountFixed: {
    width: 110,
    fontSize: 12,
    textAlign: 'right',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  paymentCard: {
    padding: 16,
    marginBottom: 16,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  paymentOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedPayment: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  selectedText: {
    color: '#fff',
    fontWeight: '600',
  },
  paymentText: {
    color: COLORS.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    padding: 20,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  itemNameLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: '#eee',
  },
  scannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  scannerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '80%',
    alignSelf: 'center',
    marginTop: '50%',
  },
  modalButton: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  quickItemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  moreBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },

  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  sheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  sheetItem: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },

  sheetItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },

  sheetItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },

  sheetItemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 4,
  },

  // Custom Bluetooth Modal Styles
  bluetoothModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent overlay - shows your screen behind
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

export default SalesScreen;
