import {
  BLEPrinter,
} from 'react-native-thermal-receipt-printer';
import { PermissionsAndroid, Platform, Alert, DeviceEventEmitter, NativeModules, NativeEventEmitter } from 'react-native';
import { BluetoothStateManager } from 'react-native-bluetooth-state-manager';
import { Order } from '../types';
import { buildReceipt } from '../utils/PrinterPreview';
import { getPrinterProfile, PrinterSize, BOLD_ON, BOLD_OFF, CENTER, LEFT, FONT_B_ON, FONT_B_OFF } from '../utils/printerProfile';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SIZES } from '../styles/theme';
import StorageService from './StorageService';
import { LogBox } from 'react-native';

// Suppress common NativeEventEmitter warnings in modern React Native versions
LogBox.ignoreLogs(['new NativeEventEmitter']);

// Patch NativeModules to satisfy NativeEventEmitter for problematic libraries
const fixEmitter = (name: string) => {
  if (NativeModules[name] && !NativeModules[name].addListener) {
    console.log(`[PrinterService] Patching ${name} for NativeEventEmitter`);
    NativeModules[name].addListener = () => { };
    NativeModules[name].removeListeners = () => { };
  }
};
fixEmitter('RNBluetoothStateManager');
fixEmitter('RNThermalReceiptPrinter');
fixEmitter('BLEPrinter');
fixEmitter('BluetoothModule');

const { BluetoothModule } = NativeModules;
const bluetoothEventEmitter = new NativeEventEmitter(BluetoothModule);

export interface BluetoothDevice {
  name: string;
  address: string;
  paired?: boolean; // Added to track pairing status
  class?: number;
}

type PermissionStatus = 'granted' | 'denied' | 'never_ask_again';

class PrinterService {
  private _connectedAddress: string | null = null;
  private _bluetoothEnabled: boolean = true;
  private _listeners: ((connected: boolean) => void)[] = [];
  private _bluetoothListeners: ((enabled: boolean) => void)[] = [];
  private _isInitialized: boolean = false;

  constructor() {
    this.setupBluetoothListener();
  }

  /**
   * CRITICAL: Ensures the native printer adapter is initialized and stabilized.
   * This is the ONLY place where BLEPrinter.init() should be called.
   */
  private async ensureInitialized(): Promise<boolean> {
    try {
      if (this._isInitialized) return true;

      console.log('[PrinterService] Initializing native printer adapter...');
      await BLEPrinter.init();

      // Mandatory stabilization delay for the native bridge/adapter
      await new Promise(resolve => setTimeout(() => resolve(true), 1000));

      this._isInitialized = true;
      console.log('[PrinterService] Native printer adapter ready.');
      return true;
    } catch (e) {
      console.error('[PrinterService] Failed to initialize native adapter:', e);
      return false;
    }
  }

  private setupBluetoothListener() {
    if (Platform.OS === 'android') {
      const bsm = BluetoothStateManager as any;
      if (bsm && typeof bsm.onStateChange === 'function') {
        try {
          bsm.onStateChange((state: string) => {
            console.log('[PrinterService] Bluetooth State Changed:', state);
            const isEnabled = state === 'PoweredOn';

            // Proactively update and notify if changed
            if (this._bluetoothEnabled !== isEnabled) {
              this._bluetoothEnabled = isEnabled;
              this.notifyBluetoothListeners(isEnabled);
              if (!isEnabled) {
                this._connectedAddress = null;
                this.notifyListeners(false);
              } else {
                this.autoConnect();
              }
            }
          }, true);
        } catch (e) {
          console.warn('[PrinterService] Failed to setup Bluetooth listener:', e);
        }
      } else {
        console.warn('[PrinterService] BluetoothStateManager not available, using polling fallback');
        // Initial detection
        this.isBluetoothEnabled();
        // Simple polling every 10 seconds only as a last resort
        setInterval(() => {
          this.isBluetoothEnabled();
        }, 10000);
      }
    }
  }

  private notifyListeners(connected: boolean) {
    this._listeners.forEach(l => l(connected));
  }

  onConnectChange(callback: (connected: boolean) => void) {
    this._listeners.push(callback);
  }

  offConnectChange(callback: (connected: boolean) => void) {
    this._listeners = this._listeners.filter(l => l !== callback);
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      // 🔹 Android 12+ (API 31+)
      if (Platform.Version >= 31) {
        const connectGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        );
        const scanGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
        );

        if (connectGranted && scanGranted) {
          return true;
        }

        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        ]);

        return (
          result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
          PermissionsAndroid.RESULTS.GRANTED &&
          result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
          PermissionsAndroid.RESULTS.GRANTED
        );
      }

      // 🔹 Android < 12 (API < 31)
      const locationGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );

      if (locationGranted) {
        return true;
      }

      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );

      return result === PermissionsAndroid.RESULTS.GRANTED;

    } catch (error) {
      Alert.alert('Permission Error', 'Failed to request Bluetooth permission. Please check your settings.');
      return false;
    }
  }

  async scanDevices(): Promise<BluetoothDevice[]> {
    return this.discoverDevices();
  }

  /**
   * Discover all Bluetooth devices (paired + unpaired)
   * This method uses custom Native Module for full device discovery
   */
  async discoverDevices(): Promise<BluetoothDevice[]> {
    try {
      const granted = await this.requestPermissions();
      if (!granted) throw new Error('Bluetooth permission not granted');

      const bluetoothEnabled = await this.isBluetoothEnabled();
      if (!bluetoothEnabled) {
        console.log('[PrinterService] Discovery aborted: Bluetooth is OFF');
        return [];
      }

      console.log('[PrinterService] Starting device discovery via Native BluetoothModule...');

      // 1. Get Paired Devices already known
      let pairedDevices: BluetoothDevice[] = [];
      try {
        const paired = await BluetoothModule.getPairedDevices();
        if (Array.isArray(paired)) {
          pairedDevices = paired.map((d: any) => ({
            name: d.name || 'Unknown',
            address: d.address,
            paired: true,
            class: d.class
          }));
        }
      } catch (e) {
        console.warn('Failed to get paired devices', e);
      }

      // 2. Start Discovery for Unpaired
      const foundDevicesWithDupeMap = new Map<string, BluetoothDevice>();

      // Seed with paired
      pairedDevices.forEach(d => foundDevicesWithDupeMap.set(d.address, d));

      try {
        await BluetoothModule.startDiscovery();
      } catch (e) {
        console.warn('Failed to start native discovery', e);
        return pairedDevices; // Fallback to paired only
      }

      // 3. Listen for events for 8 seconds
      return new Promise<BluetoothDevice[]>((resolve) => {
        const listener = bluetoothEventEmitter.addListener('BluetoothDeviceFound', (device: any) => {
          if (device && device.address && !foundDevicesWithDupeMap.has(device.address)) {
            // FILTER: Logic to check if it's a printer
            if (this.isLikelyPrinter(device)) {
              foundDevicesWithDupeMap.set(device.address, {
                name: device.name || 'Unknown',
                address: device.address,
                paired: false,
                class: device.class
              });
            } else {
              // console.log(`[PrinterService] Ignored non-printer: ${device.name} (${device.class})`);
            }
          }
        });

        // Stop after 8 seconds
        setTimeout(async () => {
          listener.remove();
          BluetoothModule.stopDiscovery().catch(() => { });

          const allDevices = Array.from(foundDevicesWithDupeMap.values());
          console.log(`[PrinterService] Discovery complete. Found ${allDevices.length} devices.`);
          resolve(allDevices);
        }, 8000);
      });

    } catch (error: any) {
      console.error('[PrinterService] Error discovering devices:', error);
      return [];
    }
  }

  // Helper to determine if a device is likely a printer
  private isLikelyPrinter(device: any): boolean {
    const majorClass = device.class || 7936; // Default to Uncategorized if missing
    const name = (device.name || '').toLowerCase();

    // 1. Explicitly EXCLUDE known non-printers
    // 256: Computer (Laptop, Desktop)
    // 512: Phone (Mobile, Smartphone)
    // 1024: Audio/Video (Headset, Speaker, TV)
    // 1280: Peripheral (Keyboard, Mouse) - BE CAREFUL, some printers act as periphs? usually not, keyboards are 1280. 
    //       But let's stick to safe excludes.
    // 1792: Wearable (Watch)
    // 2048: Toy
    // 2304: Health
    const EXCLUDED_CLASSES = [256, 512, 1024, 1792, 2048, 2304];

    if (EXCLUDED_CLASSES.includes(majorClass)) {
      return false;
    }

    // 2. Explicitly INCLUDE Imaging (Printers) - 1536
    if (majorClass === 1536) {
      return true;
    }

    // 3. (Removed Keyword Logic)
    // We now rely solely on Class Filtering.
    // If it wasn't excluded in Step 1, we show it (to ensure we don't miss obscure printers).

    return true;

    // Default: Show Uncategorized/Peripheral devices that passed the exclusions
    return true;
  }

  async pairDevice(address: string): Promise<boolean> {
    try {
      const bluetoothEnabled = await this.isBluetoothEnabled();
      if (!bluetoothEnabled) {
        console.log('[PrinterService] Pairing aborted: Bluetooth is OFF');
        return false;
      }

      console.log('[PrinterService] Attempting to pair (bond) with:', address);

      // Use Native Module pairing
      const result = await BluetoothModule.pairDevice(address);
      if (result) {
        console.log('[PrinterService] Bond request initiated/created successfully.');
        // Wait for user to interact with the dialog system-wide
        await new Promise(r => setTimeout(() => r(true), 2000));
        return true;
      }
      return false;

    } catch (error: any) {
      console.error('[PrinterService] Error pairing device:', error);
      return false;
    }
  }

  async isPaired(address: string): Promise<boolean> {
    return false;
  }

  async cancelDiscovery(): Promise<void> {
    // Not implemented 
  }



  async enableBluetooth(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      const { ToastAndroid } = require('react-native');

      // Use named import from Nitro module 2.x
      const bsm = BluetoothStateManager as any;

      if (!bsm) {
        console.error('[PrinterService] BluetoothStateManager module not found (Named Import failure)');
        ToastAndroid.show('Bluetooth module error', ToastAndroid.SHORT);
        return false;
      }

      console.log('[PrinterService] Attempting to enable Bluetooth...');

      // PRIORITIZE System Dialog (requestToEnable)
      // This ensures the user sees the popup as requested ("Android ota popup")
      // Silent enable (bsm.enable) is unreliable on modern Android without prior permissions
      if (typeof bsm.requestToEnable === 'function') {
        try {
          console.log('[PrinterService] Showing system Bluetooth dialog (requestToEnable)...');
          await bsm.requestToEnable();
          return true;
        } catch (e) {
          console.log('[PrinterService] System requestToEnable failed/denied:', e);
          // If denied by user, we shouldn't try silent enable as it will likely fail too
          return false;
        }
      }

      // Fallback: Silent enable (only if requestToEnable is missing)
      if (typeof bsm.enable === 'function') {
        try {
          console.log('[PrinterService] Trying silent enable (fallback)...');
          await bsm.enable();
          console.log('[PrinterService] Silent enable succeeded!');
          return true;
        } catch (e) {
          console.log('[PrinterService] Silent enable failed:', e);
        }
      }

      return false;
    } catch (e) {
      console.error('[PrinterService] Failed to enable Bluetooth:', e);
      return false;
    }
  }

  async waitForBluetooth(timeoutMs: number = 5000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const enabled = await this.isBluetoothEnabled();
      if (enabled) return true;
      await new Promise(resolve => setTimeout(() => resolve(true), 500));
    }
    return false;
  }

  async checkPermissionsOnly(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      if (Number(Platform.Version) >= 31) {
        return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
      }
      return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    } catch (e) {
      return false;
    }
  }

  async connectPrinter(address: string): Promise<boolean> {
    if (!BLEPrinter || !BLEPrinter.connectPrinter) {
      console.warn('BLEPrinter module not available');
      return false;
    }

    try {
      if (!address || !address.trim()) throw new Error('Invalid printer address');

      // Check Bluetooth again before connecting
      const isEnabled = await this.isBluetoothEnabled();
      if (!isEnabled) {
        console.log('[PrinterService] connectPrinter: Bluetooth is OFF, cannot connect');
        return false;
      }

      // Guarded call
      await this.ensureInitialized();

      // CRITICAL: Always close existing connection first to clear stale sockets
      console.log('[PrinterService] Closing existing connection before new connect...');
      try {
        await BLEPrinter.closeConn();
        await new Promise(resolve => setTimeout(() => resolve(true), 300));
      } catch (e) { /* ignore */ }

      // Connect
      console.log('[PrinterService] Connecting to:', address);
      await BLEPrinter.connectPrinter(address);

      // ✅ STABILIZATION DELAY: Give the Bluetooth bridge time to settle
      console.log('[PrinterService] Connect success, waiting for stabilization...');
      await new Promise(resolve => setTimeout(() => resolve(true), 1000));

      // ✅ Cache the connected address
      this._connectedAddress = address;

      await AsyncStorage.setItem('PRINTER_ADDRESS', address);
      this.notifyListeners(true);
      return true;
    } catch (error: unknown) {
      console.error('Error connecting printer:', error instanceof Error ? error.message : error);
      // Force close to ensure no stale state
      try {
        await BLEPrinter.closeConn();
      } catch (e) { /* ignore */ }

      this._connectedAddress = null; // Reset on failure
      return false;
    }
  }

  async isBluetoothEnabled(): Promise<boolean> {
    let isEnabled = true;
    try {
      if (Platform.OS === 'android') {
        const bsm = BluetoothStateManager as any;
        if (bsm && typeof bsm.getState === 'function') {
          const state = await bsm.getState();
          console.log('[PrinterService] BluetoothStateManager.getState():', state);
          isEnabled = state === 'PoweredOn';
        } else {
          // If BSM is failed, we just rely on last known state
          isEnabled = this._bluetoothEnabled;
        }
      }
    } catch (e: any) {
      console.error('[PrinterService] Overall check error:', e);
      isEnabled = false;
    }

    // Notify if state changed
    if (this._bluetoothEnabled !== isEnabled) {
      console.log('[PrinterService] Bluetooth state changed detected:', isEnabled);
      this._bluetoothEnabled = isEnabled;
      this.notifyBluetoothListeners(isEnabled);
      if (!isEnabled) {
        this._connectedAddress = null;
        this.notifyListeners(false);
      }
    }

    return isEnabled;
  }

  async isPrinterConnected(): Promise<boolean> {
    return !!this._connectedAddress;
  }

  async getDetailedStatus(): Promise<{ status: 'off' | 'disconnected' | 'connected'; message: string }> {
    // Return cached/sync state if we have it, but trigger a fresh check in background
    const isEnabled = this._bluetoothEnabled;
    const isConnected = !!this._connectedAddress;

    // Trigger check for next time
    this.isBluetoothEnabled().catch(e => console.error('getDetailedStatus background check failed:', e));

    if (!isEnabled) {
      return { status: 'off', message: 'Bluetooth is OFF' };
    }

    if (!isConnected) {
      return { status: 'disconnected', message: 'Printer Disconnected' };
    }

    return { status: 'connected', message: 'Printer Connected' };
  }

  isBluetoothEnabledSync(): boolean {
    return this._bluetoothEnabled;
  }

  onBluetoothStateChange(listener: (enabled: boolean) => void) {
    this._bluetoothListeners.push(listener);
  }

  offBluetoothStateChange(listener: (enabled: boolean) => void) {
    this._bluetoothListeners = this._bluetoothListeners.filter(l => l !== listener);
  }

  private notifyBluetoothListeners(enabled: boolean) {
    this._bluetoothListeners.forEach(listener => listener(enabled));
  }

  async isConnected(): Promise<boolean> {
    try {
      // First check if Bluetooth is enabled
      const bluetoothEnabled = await this.isBluetoothEnabled();
      if (!bluetoothEnabled) {
        this._connectedAddress = null;
        this.notifyListeners(false);
        return false;
      }

      if (this._connectedAddress) return true;

      const savedAddress = await AsyncStorage.getItem('PRINTER_ADDRESS');
      if (savedAddress) {
        // If we have a saved address but it's not in memory, 
        // we sync it to keep the UI consistent with PrinterScreen
        this._connectedAddress = savedAddress;
        return true;
      }

      return false;
    } catch (e) {
      console.error('Check connection error:', e);
      return false;
    }
  }

  async autoConnect(): Promise<boolean> {
    try {
      const permission = await this.requestPermissions();
      if (!permission) return false;

      const savedAddress = await AsyncStorage.getItem('PRINTER_ADDRESS');
      if (!savedAddress) {
        console.log('No printer configured');
        return false;
      }

      return await this.connectPrinter(savedAddress);
    } catch (e) {
      console.error('Auto connect error:', e);
      return false;
    }
  }

  async printReceipt(order: Order): Promise<boolean> {
    try {
      console.log('[PrinterService] Starting printReceipt...');

      // 0. Double check Bluetooth
      const bluetoothEnabled = await this.isBluetoothEnabled();
      if (!bluetoothEnabled) {
        throw new Error('Bluetooth is turned OFF');
      }

      // 1. Force a fresh connection check
      console.log('[PrinterService] Verifying connection state...');
      const savedAddress = await AsyncStorage.getItem('PRINTER_ADDRESS');
      if (!savedAddress) throw new Error('No printer configured');

      // If we don't have a cached address, or we just want to be sure, connect again
      // The updated connectPrinter now handles reset and delay
      const connected = await this.connectPrinter(savedAddress);

      if (!connected) {
        throw new Error('Failed to establish/verify printer connection');
      }

      // Guarded call
      await this.ensureInitialized();

      const printerSize = await this.getPrinterSize();
      const store = await StorageService.getStoreDetails();

      console.log('[PrinterService] Building receipt...');
      const receipt = buildReceipt(order, printerSize, store);

      // 2. Try Print
      console.log('[PrinterService] Calling BLEPrinter.printText...');
      // We check if it's reachable one last time if possible
      await BLEPrinter.printText(receipt);
      console.log('[PrinterService] Print command sent successfully.');

      // Short delay after print to ensure buffer is cleared before we return "success"
      await new Promise(resolve => setTimeout(() => resolve(true), 500));

      return true;
    } catch (e) {
      console.warn('[PrinterService] Print failed:', e);
      return false;
    }
  }

  async getPrinterSize(): Promise<PrinterSize> {
    try {
      const size = await AsyncStorage.getItem('printerSize');
      return (size as PrinterSize) || '58mm';
    } catch {
      return '58mm';
    }
  }

  async disconnect(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      await BLEPrinter.closeConn();
      this._connectedAddress = null; // Clear state
      this.notifyListeners(false);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error disconnecting:', errorMessage);
      this._connectedAddress = null; // Assume disconnected on error too
      return false;
    }
  }

  generateReportString(data: {
    title: string;
    dateRange: string;
    stats: { totalSales: number; totalOrders: number; averageOrder: number };
    items: { name: string; qty: number; total: number }[];
  }, printerSize: PrinterSize = '58mm', forPreview: boolean = false): string {
    const P = getPrinterProfile(printerSize);

    // Commands based on mode
    const b_on = forPreview ? '[B]' : BOLD_ON;
    const b_off = forPreview ? '[/B]' : BOLD_OFF;
    const center = forPreview ? '' : CENTER;
    const left = forPreview ? '' : LEFT;
    const f_b_on = forPreview ? '' : (printerSize === '58mm' ? FONT_B_ON : '');
    const f_b_off = forPreview ? '' : (printerSize === '58mm' ? FONT_B_OFF : '');

    let report = forPreview ? '' : '\x1b\x40';


    report += f_b_on; // Start Font B early if 58mm for header consistency

    // Header
    const cleanTitle = data.title.replace(/^\d+/, '');
    report += center + b_on + cleanTitle + b_off + '\n';

    report += center + data.dateRange + '\n';
    report += b_on + '='.repeat(P.WIDTH) + b_off + '\n' + left;

    // Summary - Using b_on/b_off for labels
    report += b_on + formatLine('Total Sales', data.stats.totalSales, P.WIDTH) + b_off;
    report += b_on + formatLine('Total Orders', data.stats.totalOrders, P.WIDTH) + b_off;
    report += formatLine('Avg Order', data.stats.averageOrder, P.WIDTH);
    report += '-'.repeat(P.WIDTH) + '\n';

    // Item Header proportions (Synchronized with Bill style: space between cols)
    const itemW = printerSize === '58mm' ? 14 : 30; // Reduced for space (Width 32: 14 + 1 + 6 + 1 + 10 = 32)
    const qtyW = 6;
    const amtW = P.WIDTH - itemW - qtyW - 2; // -2 for spaces

    report += b_on + 'Product Summary' + b_off + '\n';
    report += formatColumn('Item', itemW) + ' ' +
      formatColumn('Qty', qtyW, 'right') + ' ' +
      formatColumn('Amt', amtW, 'right') + '\n';
    report += '-'.repeat(P.WIDTH) + '\n';


    let serial = 1;

    for (const item of data.items) {
      const nameLines = wrapByTwoWords(item.name);

      report += formatColumn(serial + '. ' + nameLines[0], itemW) + ' ' +
        formatColumn(item.qty.toString(), qtyW, 'right') + ' ' +
        formatColumn(item.total.toFixed(2), amtW, 'right') + '\n';

      for (let i = 1; i < nameLines.length; i++) {
        report += formatColumn('    ' + nameLines[i], itemW) + ' ' +
          formatColumn('', qtyW, 'right') + ' ' +
          formatColumn('', amtW, 'right') + '\n';
      }

      serial++;
    }

    report += '-'.repeat(P.WIDTH) + '\n';
    report += center + b_on + 'END OF REPORT' + b_off + '\n';
    report += '='.repeat(P.WIDTH) + '\n' + left;

    report += f_b_off;

    report += '\n\n\n';
    return report;
  }

  async printReport(data: {
    title: string;
    dateRange: string;
    stats: { totalSales: number; totalOrders: number; averageOrder: number };
    items: { name: string; qty: number; total: number }[];
  }): Promise<boolean> {
    try {
      // 1. Ensure connected
      await this.autoConnect();
      await this.ensureInitialized();
      const printerSize = await this.getPrinterSize();
      const report = this.generateReportString(data, printerSize);
      // 2. Try Print
      await BLEPrinter.printText(report);
      return true;
    } catch (e) {
      console.warn('Print report failed, retrying connection...', e);
      // 3. RETRY LOGIC
      try {
        await this.disconnect();
        const connected = await this.autoConnect();
        if (connected) {
          await this.ensureInitialized();
          const printerSize = await this.getPrinterSize();
          const report = this.generateReportString(data, printerSize);
          await BLEPrinter.printText(report);
          return true;
        }
      } catch (retryError) {
        console.error('Retry report failed:', retryError);
      }

      this._connectedAddress = null; // Reset connection on failure
      return false;
    }
  }
}

// Helper to align columns
function formatColumn(text: string, width: number, align: 'left' | 'right' = 'left') {
  text = text.toString();
  if (text.length > width) return text.substring(0, width); // truncate if too long
  return align === 'left' ? text.padEnd(width) : text.padStart(width);
}


function formatLine(label: string, value: string | number, width: number = 32): string {
  const valStr = typeof value === 'number' ? `Rs.${value.toFixed(2)}` : value.toString();
  const space = width - label.length - valStr.length;
  return label + ' '.repeat(space > 0 ? space : 0) + valStr + '\n';
}

export default new PrinterService();

function wrapByTwoWords(text: string): string[] {
  const words = text.split(' ');
  const lines: string[] = [];

  for (let i = 0; i < words.length; i += 2) {
    lines.push(words.slice(i, i + 2).join(' '));
  }

  return lines;
}

