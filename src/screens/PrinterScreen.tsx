import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, FlatList, Alert, ToastAndroid, Platform, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, SIZES, SHADOWS } from '../styles/theme';
import Header from '../components/Header';
import { RootStackParamList } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PrinterService, { BluetoothDevice } from '../services/PrinterService';
import { StoreDetails } from '../services/StoreDetails';
import StorageService from '../services/StorageService';
import RBSheet from 'react-native-raw-bottom-sheet';

type PrinterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Printer'>;

interface PrinterScreenProps {
    navigation: PrinterScreenNavigationProp;
}
interface RBSheetRef {
    open: () => void;
    close: () => void;
}

const PrinterScreen: React.FC<PrinterScreenProps> = ({ navigation }) => {
    const [autoPrint, setAutoPrint] = useState(true);
    const [printers, setPrinters] = useState<BluetoothDevice[]>([]);
    const [scanning, setScanning] = useState(false);
    const [discovering, setDiscovering] = useState(false);
    const [pairingAddress, setPairingAddress] = useState<string | null>(null);
    const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
    const [connectedPrinter, setConnectedPrinter] = useState<BluetoothDevice | null>(null);
    const [printerSize, setPrinterSize] = useState<'58mm' | '80mm'>('58mm');
    const [btStatus, setBtStatus] = useState<{ status: 'off' | 'disconnected' | 'connected'; message: string }>({ status: 'connected', message: 'Printer Connected' });
    const [isEnabling, setIsEnabling] = useState(false);

    // TWO RBSheets: One for Store Details, One for Printer Selection
    const [savedPrinter, setSavedPrinter] = useState<BluetoothDevice | null>(null);
    const [isReconnecting, setIsReconnecting] = useState(false);

    // TWO RBSheets: One for Store Details, One for Printer Selection
    const refStoreSheet = useRef<RBSheetRef>(null);
    const refPrinterSheet = useRef<RBSheetRef>(null);

    const [store, setStore] = useState<StoreDetails>({ name: '', location: '', phone: '' });
    const [tempStore, setTempStore] = useState<StoreDetails>({ name: '', location: '', phone: '' });
    const hasScannedRef = useRef(false);

    useEffect(() => {
        const loadStore = async () => {
            const details = await StorageService.getStoreDetails();
            setStore(details);
            setTempStore(details);
        };
        loadStore();

        // Bluetooth listener
        const handleBtChange = (_enabled: boolean) => {
            PrinterService.getDetailedStatus().then(setBtStatus);
        };

        PrinterService.onBluetoothStateChange(handleBtChange);
        PrinterService.getDetailedStatus().then(setBtStatus);

        return () => {
            PrinterService.offBluetoothStateChange(handleBtChange);
        };
    }, []);

    useEffect(() => {
        const loadPrinterSize = async () => {
            const savedSize = await AsyncStorage.getItem('printerSize');
            if (savedSize === '58mm' || savedSize === '80mm') {
                setPrinterSize(savedSize);
            }
        };
        loadPrinterSize();
    }, []);


    useEffect(() => {
        const loadSavedPrinter = async () => {
            const address = await AsyncStorage.getItem('PRINTER_ADDRESS');
            const name = await AsyncStorage.getItem('PRINTER_NAME');

            if (address && name) {
                // ONLY set savedPrinter, do NOT assume connected yet
                setSavedPrinter({ address, name });

                // Optional: Trigger a background check or auto-connect trial?
                // For now, we rely on the logic: if saved but not connected -> show Reconnect UI
                // But we can verify if the Service thinks it's connected
                const isConnected = await PrinterService.isPrinterConnected();
                if (isConnected) {
                    setConnectedAddress(address);
                    setConnectedPrinter({ address, name });
                }
            }
        };

        const handleStatusChange = (isConnected: boolean) => {
            if (!isConnected) {
                setConnectedAddress(null);
                setConnectedPrinter(null);
            } else {
                // If connected, ensure we populate state
                if (savedPrinter) {
                    setConnectedAddress(savedPrinter.address);
                    setConnectedPrinter(savedPrinter);
                }
            }
        };

        loadSavedPrinter();
        PrinterService.onConnectChange(handleStatusChange);

        return () => {
            PrinterService.offConnectChange(handleStatusChange);
        };
    }, [savedPrinter]); // Depend on savedPrinter so handleStatusChange can access it if needed (though closure might catch old, better use Ref or simple logic)

    const handleScan = async () => {
        if (btStatus.status === 'off') {
            // Show toast and trigger Bluetooth enable in background
            ToastAndroid.show('Please enable Bluetooth to scan', ToastAndroid.SHORT);

            // Don't await - let it happen in background
            PrinterService.enableBluetooth().then(async (success) => {
                if (success) {
                    const nowEnabled = await PrinterService.waitForBluetooth(8000);
                    if (nowEnabled) {
                        ToastAndroid.show('Bluetooth enabled! You can scan now.', ToastAndroid.LONG);
                    } else {
                        ToastAndroid.show('Bluetooth took too long to turn on', ToastAndroid.LONG);
                    }
                } else {
                    ToastAndroid.show('Please enable Bluetooth manually', ToastAndroid.LONG);
                }
            });
            return;
        }

        const granted = await PrinterService.requestPermissions();
        if (!granted) {
            Alert.alert('Permission Required', 'Please allow Bluetooth permission to scan printers');
            return;
        }

        setDiscovering(true);
        setPrinters([]);
        try {
            // Use new discovery method to find both paired and unpaired devices
            const devices = await PrinterService.discoverDevices();
            setPrinters(devices);
            ToastAndroid.show(`Found ${devices.length} device(s)`, ToastAndroid.SHORT);
        } catch (e) {
            console.error(e);
            Alert.alert('Scan Error', 'Failed to scan for Bluetooth devices.');
        } finally {
            setDiscovering(false);
        }
    };

    const handlePairDevice = async (device: BluetoothDevice) => {
        setPairingAddress(device.address);
        ToastAndroid.show(`Pairing with ${device.name}...`, ToastAndroid.SHORT);

        try {
            const success = await PrinterService.pairDevice(device.address);
            if (success) {
                ToastAndroid.show('Paired successfully! Connecting...', ToastAndroid.SHORT);

                // 1. Refresh list to update UI (remove "Not Paired" badge)
                handleScan();

                // 2. Auto-Connect immediately
                await handleConnect(device);
            } else {
                ToastAndroid.show('Failed to pair', ToastAndroid.LONG);
            }
        } catch (e) {
            console.error(e);
            ToastAndroid.show('Pairing error', ToastAndroid.LONG);
        } finally {
            setPairingAddress(null);
        }
    };

    const handleOpenPrinterSheet = () => {
        refPrinterSheet.current?.open();
        // Auto scan if not already scanned or empty
        if (btStatus.status !== 'off' && printers.length === 0) {
            handleScan();
        }
    };

    const handleConnect = async (device: BluetoothDevice) => {
        // Close sheet first or show loading? nicely show loading on item
        // For simple UX, let's keep sheet open but show global loading or toast
        ToastAndroid.show(`Connecting to ${device.name}...`, ToastAndroid.SHORT);

        const success = await PrinterService.connectPrinter(device.address);
        if (success) {
            setConnectedAddress(device.address);
            setConnectedPrinter(device);
            // Update Saved Printer State too!
            setSavedPrinter(device);

            await AsyncStorage.setItem('PRINTER_ADDRESS', device.address);
            await AsyncStorage.setItem('PRINTER_NAME', device.name);
            ToastAndroid.show(`Connected successfully!`, ToastAndroid.SHORT);
            refPrinterSheet.current?.close();
        } else {
            ToastAndroid.show(`Failed to connect`, ToastAndroid.LONG);
        }
    };

    const handleDisconnect = async () => {
        await PrinterService.disconnect();
        setConnectedAddress(null);
        setConnectedPrinter(null);
        setSavedPrinter(null); // Clear saved printer on explicit disconnect
        await AsyncStorage.removeItem('PRINTER_ADDRESS');
        await AsyncStorage.removeItem('PRINTER_NAME');
        ToastAndroid.show('Disconnected', ToastAndroid.SHORT);
    };

    const handleReconnect = async () => {
        if (!savedPrinter) return;
        setIsReconnecting(true);
        try {
            // 1. Permission check
            const permissionGranted = await PrinterService.requestPermissions();
            if (!permissionGranted) {
                Alert.alert('Permission Required', 'Bluetooth permission is required');
                return;
            }

            // 2. Enable Bluetooth if needed
            const btEnabled = await PrinterService.isBluetoothEnabled();
            if (!btEnabled) {
                const success = await PrinterService.enableBluetooth();
                if (!success) {
                    Alert.alert('Bluetooth Off', 'Please enable Bluetooth');
                    return;
                }
                await PrinterService.waitForBluetooth();
            }

            // 3. Connect (with min delay for UX)
            const minDelay = new Promise<void>(resolve => setTimeout(() => resolve(), 1500));
            const connectPromise = PrinterService.connectPrinter(savedPrinter.address);

            const [_, success] = await Promise.all([minDelay, connectPromise]);

            if (success) {
                setConnectedAddress(savedPrinter.address);
                setConnectedPrinter(savedPrinter);
                ToastAndroid.show('Connected!', ToastAndroid.SHORT);
            } else {
                Alert.alert(
                    'Printer Not Found',
                    `Could not connect to "${savedPrinter.name}".\n\n1. Make sure printer is ON.\n2. Make sure it is close by.`,
                    [{ text: 'OK' }]
                );
            }
        } catch (e) {
            console.error(e);
            ToastAndroid.show('Error reconnecting', ToastAndroid.SHORT);
        } finally {
            setIsReconnecting(false);
        }
    };

    // UI Helpers

    const handleSaveStore = async () => {
        const safeStore: StoreDetails = {
            name: tempStore.name || '',
            location: tempStore.location || '',
            phone: tempStore.phone || ''
        };
        const success = await StorageService.saveStoreDetails(safeStore);
        if (success) {
            setStore(safeStore);
            Alert.alert('Success', 'Store details saved successfully!');
            refStoreSheet.current?.close();
        } else {
            Alert.alert('Error', 'Failed to save store details');
        }
    };

    const handleSizeChange = async (size: '58mm' | '80mm') => {
        setPrinterSize(size);
        await AsyncStorage.setItem('printerSize', size);
    };

    const renderPrinterItem = ({ item }: { item: BluetoothDevice }) => {
        const isConnected = item.address === connectedAddress;
        const isPaired = item.paired !== false;
        const isPairing = pairingAddress === item.address;

        return (
            <TouchableOpacity
                style={[styles.deviceItem, isConnected && styles.deviceItemConnected]}
                onPress={() => isPaired && !isPairing ? handleConnect(item) : null}
                disabled={!isPaired || isPairing}
            >
                <View style={styles.deviceIconBg}>
                    <Icon name={isConnected ? "printer-check" : "printer-wireless"} size={24} color={isConnected ? COLORS.primary : COLORS.textSecondary} />
                </View>
                <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
                    <Text style={styles.deviceAddress}>{item.address}</Text>
                    {!isPaired && (
                        <View style={styles.unpairedBadge}>
                            <Text style={styles.unpairedBadgeText}>Not Paired</Text>
                        </View>
                    )}
                </View>
                {isConnected && <Icon name="check-circle" size={20} color={COLORS.primary} />}
                {!isPaired && !isPairing && (
                    <TouchableOpacity
                        style={styles.pairButton}
                        onPress={() => handlePairDevice(item)}
                    >
                        <Text style={styles.pairButtonText}>Pair</Text>
                    </TouchableOpacity>
                )}
                {isPairing && <ActivityIndicator size="small" color={COLORS.primary} />}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <Header
                title="Printer Settings"
                icon="printer-settings"
                subtitle="Manage Receipts & Hardware"
                onBack={() => navigation.goBack()}
            />

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>

                {/* 1. Printer Connection Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Printer Connection</Text>

                    {btStatus.status === 'off' ? (
                        <TouchableOpacity
                            style={[styles.connectStateEmpty, { borderColor: COLORS.danger, borderStyle: 'solid' }]}
                            disabled={isEnabling}
                            onPress={async () => {
                                setIsEnabling(true);
                                // Request permissions first!
                                const granted = await PrinterService.requestPermissions();
                                if (!granted) {
                                    Alert.alert('Permission Required', 'Bluetooth permission is needed to turn on Bluetooth.');
                                    setIsEnabling(false);
                                    return;
                                }

                                const success = await PrinterService.enableBluetooth();
                                if (success) {
                                    // Wait for state to change automatically via listener
                                    const nowEnabled = await PrinterService.waitForBluetooth(8000);
                                    if (nowEnabled) {
                                        // AUTOMATIC CONNECT Logic after turning on
                                        if (savedPrinter) {
                                            ToastAndroid.show(`Bluetooth enabled! Connecting to ${savedPrinter.name}...`, ToastAndroid.SHORT);
                                            await PrinterService.connectPrinter(savedPrinter.address);
                                            // The onConnectChange listener will update the state
                                        } else {
                                            ToastAndroid.show('Bluetooth enabled!', ToastAndroid.SHORT);
                                        }
                                    } else {
                                        Alert.alert('Timeout', 'Bluetooth took too long to turn on.');
                                    }
                                } else {
                                    Alert.alert('Bluetooth OFF', 'Please enable Bluetooth in settings');
                                }
                                setIsEnabling(false);
                            }}
                        >
                            <View style={[styles.emptyStateIcon, { backgroundColor: COLORS.danger + '10' }]}>
                                {isEnabling ? (
                                    <ActivityIndicator size="large" color={COLORS.danger} />
                                ) : (
                                    <Icon name="bluetooth-off" size={36} color={COLORS.danger} />
                                )}
                            </View>
                            <Text style={[styles.emptyStateTitle, { color: COLORS.danger }]}>
                                {isEnabling ? 'Processing...' : 'Bluetooth is OFF'}
                            </Text>
                            <Text style={styles.emptyStateSub}>
                                {isEnabling ? 'Enabling Bluetooth, please wait...' : 'Tap to turn on Bluetooth and connect printers'}
                            </Text>
                        </TouchableOpacity>
                    ) : connectedPrinter ? (
                        <View style={styles.connectedCard}>
                            <View style={styles.connectedHeader}>
                                <View style={styles.connectedIcon}>
                                    <Icon name="printer-pos" size={32} color="#fff" />
                                </View>
                                <View style={{ flex: 1, paddingHorizontal: 10 }}>
                                    <Text style={styles.connectedLabel}>Connected to</Text>
                                    <Text style={styles.connectedName} numberOfLines={1} ellipsizeMode="tail">{connectedPrinter.name}</Text>
                                    <Text style={styles.connectedAddress} numberOfLines={1} ellipsizeMode="middle">{connectedPrinter.address}</Text>
                                </View>
                                <TouchableOpacity onPress={handleDisconnect} style={styles.disconnectBtn}>
                                    <Icon name="link" size={24} color={COLORS.primary} />
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity style={styles.changePrinterBtn} onPress={handleOpenPrinterSheet}>
                                <Text style={styles.changePrinterText}>Change Printer</Text>
                                <Icon name="chevron-right" size={16} color={COLORS.primary} />
                            </TouchableOpacity>
                        </View>
                    ) : savedPrinter ? (
                        <View style={[styles.connectStateEmpty, { borderColor: COLORS.warning, borderStyle: 'dashed' }]}>
                            <View style={[styles.emptyStateIcon, { backgroundColor: COLORS.warning + '15' }]}>
                                <Icon name="printer-alert" size={36} color={COLORS.warning} />
                            </View>
                            <Text style={[styles.emptyStateTitle, { color: COLORS.warning }]}>
                                Printer Disconnected
                            </Text>
                            <Text style={styles.emptyStateSub}>
                                {savedPrinter ? `Please turn on "${savedPrinter.name}"` : 'Printer is not connected'}
                            </Text>

                            <TouchableOpacity
                                style={[styles.connectBtn, { backgroundColor: COLORS.warning, marginTop: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]}
                                onPress={handleReconnect}
                                disabled={isReconnecting}
                            >
                                {isReconnecting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Icon name="refresh" size={18} color="#fff" style={{ marginRight: 6 }} />
                                        <Text style={styles.connectBtnText}>Reconnect</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity style={{ marginTop: 16 }} onPress={handleOpenPrinterSheet}>
                                <Text style={{ color: COLORS.textSecondary, textDecorationLine: 'underline' }}>Change Printer</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.connectStateEmpty} onPress={handleOpenPrinterSheet}>
                            <View style={styles.emptyStateIcon}>
                                <Icon name="printer-search" size={36} color={COLORS.primary} />
                            </View>
                            <Text style={styles.emptyStateTitle}>No Printer Connected</Text>
                            <Text style={styles.emptyStateSub}>Tap to search and connect a thermal printer</Text>
                            <View style={styles.connectBtn}>
                                <Text style={styles.connectBtnText}>Connect Printer</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                </View>

                {/* 2. Paper Size Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Paper Size</Text>
                    <View style={styles.sizeOptions}>
                        <TouchableOpacity
                            style={[styles.sizeOption, printerSize === '58mm' && styles.selectedSizeOption]}
                            onPress={() => handleSizeChange('58mm')}>
                            <Icon name="file-document-outline" size={24} color={printerSize === '58mm' ? COLORS.primary : COLORS.textSecondary} />
                            <Text style={[styles.sizeLabel, printerSize === '58mm' && styles.selectedSizeLabel]}>58mm</Text>
                            <Text style={styles.sizeSub}>Small / Thermal</Text>
                            {printerSize === '58mm' && <Icon name="check-circle" size={16} color={COLORS.primary} style={styles.checkIcon} />}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.sizeOption, printerSize === '80mm' && styles.selectedSizeOption]}
                            onPress={() => handleSizeChange('80mm')}>
                            <Icon name="file-document" size={24} color={printerSize === '80mm' ? COLORS.primary : COLORS.textSecondary} />
                            <Text style={[styles.sizeLabel, printerSize === '80mm' && styles.selectedSizeLabel]}>80mm</Text>
                            <Text style={styles.sizeSub}>Large / Standard</Text>
                            {printerSize === '80mm' && <Icon name="check-circle" size={16} color={COLORS.primary} style={styles.checkIcon} />}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 3. Store Details Section */}
                <View style={{ marginBottom: 10 }}>
                    <Text style={[styles.sectionTitle]}>Store Details</Text>

                    {(store.name) ? (
                        <View style={styles.currentDetails}>
                            {/* Name Row with edit & delete */}
                            {store.name ? (
                                <View style={styles.infoRow}>
                                    <Text style={styles.detailText}>Name: {store.name}</Text>
                                    <View style={styles.actionIcons}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setTempStore(prev => ({ ...prev, name: store.name }));
                                                refStoreSheet.current?.open();
                                            }}
                                            style={styles.iconButton}
                                        >
                                            <Icon name="pencil" size={18} color={COLORS.primary} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => setStore(prev => ({ ...prev, name: '' }))}
                                            style={styles.iconButton}
                                        >
                                            <Icon name="delete" size={18} color={COLORS.danger || 'red'} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : null}

                            {/* Location Row and Phone Row */}
                            {store.location && (
                                <View style={styles.infoRow}><Text style={styles.detailText}>Location: {store.location}</Text></View>
                            )}
                            {store.phone && (
                                <View style={styles.infoRow}><Text style={styles.detailText}>Phone: {store.phone}</Text></View>
                            )}
                        </View>
                    ) : (
                        <Text style={{ color: COLORS.textSecondary }}>No store details available.</Text>
                    )}
                </View>

                {/* 4. Auto Print Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>General</Text>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Auto-Print Receipt</Text>
                            <Text style={styles.settingDesc}>Print receipt automatically after sale</Text>
                        </View>
                        <Switch
                            value={autoPrint}
                            onValueChange={setAutoPrint}
                            trackColor={{ false: COLORS.border, true: COLORS.primary }}
                        />
                    </View>
                </View>

            </ScrollView>

            {/* --- PRINTER SELECTION SHEET --- */}
            <RBSheet
                ref={refPrinterSheet}
                height={500}
                openDuration={250}
                closeOnPressMask
                draggable
                customStyles={{
                    wrapper: { backgroundColor: 'rgba(0,0,0,0.5)' },
                    container: {
                        backgroundColor: '#fff',
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        padding: 0,
                    },
                    draggableIcon: { backgroundColor: '#cbd5e1' },
                }}
            >
                <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>Select Printer</Text>
                    {discovering && <ActivityIndicator size="small" color={COLORS.primary} />}
                    <TouchableOpacity onPress={handleScan} disabled={discovering} style={{ padding: 5 }}>
                        <Icon name="refresh" size={24} color={discovering ? COLORS.border : COLORS.primary} />
                    </TouchableOpacity>
                </View>
                <View style={styles.sheetContent}>
                    {btStatus.status === 'off' ? (
                        <View style={styles.sheetMessage}>
                            <Icon name="bluetooth-off" size={40} color={COLORS.textSecondary} />
                            <Text style={styles.sheetMessageText}>Bluetooth is off</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={printers}
                            renderItem={renderPrinterItem}
                            keyExtractor={item => item.address}
                            contentContainerStyle={{ paddingBottom: 20 }}
                            ListEmptyComponent={() => (
                                <View style={styles.sheetMessage}>
                                    {!discovering && (
                                        <>
                                            <Icon name="printer-alert" size={40} color={COLORS.textSecondary} />
                                            <Text style={styles.sheetMessageText}>No printers found</Text>
                                            <Text style={styles.sheetSubText}>
                                                Tap the refresh button to scan for nearby printers.{"\n"}
                                                Make sure your printer is turned on and in range.
                                            </Text>
                                        </>
                                    )}
                                    {discovering && <Text style={styles.sheetMessageText}>Scanning for devices...</Text>}
                                </View>
                            )}
                        />
                    )}
                </View>
            </RBSheet>


            {/* --- STORE DETAILS SHEET --- */}
            <RBSheet
                ref={refStoreSheet}
                height={500}
                openDuration={250}
                closeOnPressMask
                draggable
                customStyles={{
                    wrapper: { backgroundColor: 'rgba(0,0,0,0.5)' },
                    container: {
                        backgroundColor: '#fff',
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        padding: 20,
                    },
                    draggableIcon: { backgroundColor: '#cbd5e1' },
                }}
            >
                <Text style={styles.sheetTitle}>Edit Store Details</Text>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                    style={styles.input}
                    value={tempStore.name}
                    onChangeText={text => setTempStore(prev => ({ ...prev, name: text }))}
                    placeholder="Enter store name"
                    maxLength={50}
                />
                <Text style={styles.inputLabel}>Location</Text>
                <TextInput
                    style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                    value={tempStore.location}
                    onChangeText={text => setTempStore(prev => ({ ...prev, location: text }))}
                    placeholder="Enter location"
                    multiline={true}
                    numberOfLines={4}
                    textAlignVertical="top"
                    maxLength={100}
                />
                <Text style={styles.inputLabel}>Phone</Text>
                <TextInput
                    style={styles.input}
                    value={tempStore.phone}
                    onChangeText={text => setTempStore(prev => ({ ...prev, phone: text }))}
                    placeholder="Enter phone number"
                    keyboardType="phone-pad"
                    maxLength={10}
                />
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveStore}>
                    <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
            </RBSheet>

        </SafeAreaView>
    );
};

export default PrinterScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { flex: 1, padding: SIZES.large },
    section: { marginBottom: 24, marginTop: 2 },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

    // Connected Card Styles
    connectedCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.small },
    connectedHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: COLORS.primary },
    connectedIcon: { width: 50, height: 50, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    connectedLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
    connectedName: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
    connectedAddress: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
    disconnectBtn: { padding: 10, backgroundColor: '#fff', borderRadius: 20 },
    changePrinterBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff' },
    changePrinterText: { fontSize: 15, fontWeight: '600', color: COLORS.primary },

    // Empty State Connect Styles
    connectStateEmpty: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed' },
    emptyStateIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primary + '10', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyStateTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
    emptyStateSub: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 20 },
    connectBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, ...SHADOWS.small },
    connectBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    // Sheet Styles
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    sheetContent: { padding: 20, flex: 1 },
    sheetMessage: { alignItems: 'center', justifyContent: 'center', padding: 40 },
    sheetMessageText: { color: COLORS.textSecondary, marginTop: 10, fontSize: 16, fontWeight: '500' },
    sheetSubText: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 4 },
    deviceItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: '#f8fafc', marginBottom: 10, borderWidth: 1, borderColor: 'transparent' },
    deviceItemConnected: { backgroundColor: COLORS.primary + '10', borderColor: COLORS.primary },
    deviceIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
    deviceInfo: { flex: 1 },
    deviceName: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
    deviceAddress: { fontSize: 12, color: COLORS.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
    unpairedBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4, alignSelf: 'flex-start' },
    unpairedBadgeText: { fontSize: 11, fontWeight: '600', color: '#92400E' },
    pairButton: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    pairButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

    // Other settings styles (preserved)
    settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.surface, padding: 16, borderRadius: SIZES.radius, borderColor: COLORS.border, borderWidth: 1 },
    settingInfo: { flex: 1, marginRight: 16 },
    settingLabel: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
    settingDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
    sizeOptions: { flexDirection: 'row', gap: 12 },
    sizeOption: { flex: 1, backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.small, position: 'relative' },
    selectedSizeOption: { borderColor: COLORS.primary, borderWidth: 2 },
    sizeLabel: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginTop: 8 },
    selectedSizeLabel: { color: COLORS.primary },
    sizeSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, fontWeight: '500' },
    checkIcon: { position: 'absolute', top: 10, right: 10 },
    currentDetails: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginTop: 2, borderWidth: 1, borderColor: '#e0e0e0' },
    detailText: { fontSize: 14, color: COLORS.textPrimary, flex: 1 },
    sheetTitle: { fontSize: 18, fontWeight: 'bold' },
    inputLabel: { fontSize: 14, fontWeight: '500', marginTop: 10 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, marginTop: 5, paddingVertical: 12 },
    saveBtn: { marginTop: 20, backgroundColor: COLORS.primary, padding: 15, borderRadius: 8, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    actionIcons: { flexDirection: 'row', gap: 10 },
    iconButton: { padding: 4 },
});
