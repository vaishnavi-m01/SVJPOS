import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ToastAndroid,
    Modal,
    PermissionsAndroid,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, SIZES, SHADOWS } from '../styles/theme';
import Header from '../components/Header';
import { RootStackParamList, Item } from '../types';
import StorageService from '../services/StorageService';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { Camera } from 'react-native-camera-kit';


type ItemFormScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ItemForm'>;
type ItemFormScreenRouteProp = RouteProp<RootStackParamList, 'ItemForm'>;

interface ItemFormScreenProps {
    navigation: ItemFormScreenNavigationProp;
    route: ItemFormScreenRouteProp;
}

const ItemFormScreen: React.FC<ItemFormScreenProps> = ({ navigation, route }) => {
    const isEdit = !!route.params?.item;
    const existingItem = route.params?.item;

    const [taxes, setTaxes] = useState<any[]>([]);
    const [selectedTaxId, setSelectedTaxId] = useState<string | null>(null);
    const [showTaxDropdown, setShowTaxDropdown] = useState(false);

    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [price, setPrice] = useState('');
    const [mrp, setMrp] = useState('');
    const [rate, setRate] = useState('');
    const [stock, setStock] = useState('');
    const [description, setDescription] = useState('');
    const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
    const [inputHeight, setInputHeight] = useState(48);
    const [isMultiline, setIsMultiline] = useState(false);


    const [categories, setCategories] = useState<any[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [isDuplicateCode, setIsDuplicateCode] = useState(false);



    useFocusEffect(
        React.useCallback(() => {
            const loadTaxes = async () => {
                const taxList = await StorageService.getTaxes();
                setTaxes(taxList);

                // ✅ ONLY for ADD ITEM
                if (!isEdit) {
                    const defaultTax = taxList.find(t => t.isDefault);
                    if (defaultTax) {
                        setSelectedTaxId(defaultTax.id);
                    }
                }
            };

            loadTaxes();
        }, [isEdit])
    );


    const onBarcodeScan = (event: any) => {
        const scannedCode = event.nativeEvent.codeStringValue;

        if (!scannedCode) return;


        if (scannedCode.length === 15) {
            ToastAndroid.show(
                'IMEI code not allowed',
                ToastAndroid.SHORT
            );
            return;
        }


        if (scannedCode.length === 8 || scannedCode.length === 13) {
            setCode(scannedCode);
            setIsScanning(false);
            ToastAndroid.show(
                'EAN scanned: ' + scannedCode,
                ToastAndroid.SHORT
            );
        } else {
            ToastAndroid.show(
                'Only EAN barcode allowed',
                ToastAndroid.SHORT
            );
        }
    };



    const [loading, setLoading] = useState(false);
    const insets = useSafeAreaInsets();

    useFocusEffect(
        React.useCallback(() => {
            const loadCats = async () => {
                setLoadingCategories(true);
                const data = await StorageService.getCategories();
                setCategories(data);
                setLoadingCategories(false);
            };
            loadCats();
        }, [])
    );

    useEffect(() => {
        if (isEdit && existingItem) {
            setName(existingItem.name);
            setCode(existingItem.code);
            setPrice(existingItem.price?.toString() || '');
            setMrp(existingItem.mrp?.toString() || '');
            // setRate(existingItem.rate?.toString() || '');
            setStock(existingItem.stock ? existingItem.stock.toString() : '');
            setDescription(existingItem.description || '');
            setCategoryId(existingItem.categoryId);
            setSelectedTaxId(existingItem.taxId ?? null);

        }
    }, [isEdit, existingItem]);

    const handleSave = async () => {
        if (!name || !code || !price) {
            Alert.alert('Error', 'Please fill in all required fields (Name, Code, Price)');
            return;
        }

        const finalTaxId =
            selectedTaxId ||
            taxes.find(t => t.isDefault)?.id ||
            null;
        const selectedTax = taxes.find(t => t.id === finalTaxId);
        const gstMode = selectedTax && selectedTax.rate > 0
            ? 'EXCLUSIVE'
            : 'INCLUSIVE';


        setLoading(true);

        try {
            // 1️⃣ Fetch all items
            const allItems = await StorageService.getItems();

            // 2️⃣ Check for duplicate code
            const isDuplicateCode = allItems.some(item =>
                item.code.toLowerCase() === code.toLowerCase() &&
                (!isEdit || item.id !== existingItem?.id) // exclude current item if editing
            );

            if (isDuplicateCode) {
                setIsDuplicateCode(true);
                ToastAndroid.show('This code already exists', ToastAndroid.SHORT);
                setLoading(false);
                return;
            }

            // 🔍 Debug tax selection
            console.log('Selected Tax ID:', selectedTaxId);
            console.log('All Taxes:', taxes);

            const finalTaxId =
                selectedTaxId ||
                taxes.find(t => t.isDefault)?.id ||
                null;

            console.log('Final Tax ID used:', finalTaxId);

            const itemData = {
                name,
                code,
                price: parseFloat(price.replace(/,/g, '')),
                mrp: mrp ? parseFloat(mrp.replace(/,/g, '')) : 0,
                stock: stock ? parseInt(stock) : 0,
                description,
                categoryId,
                taxId: finalTaxId || undefined,
                barcode: '',
                gstMode,
                gstPerc: selectedTax?.rate ?? 0,
            };

            console.log('Item Data to Save:', itemData);

            if (isEdit && existingItem) {
                console.log('Editing Item ID:', existingItem.id);
                await StorageService.updateItem(existingItem.id, itemData);
                ToastAndroid.show('Item updated successfully', ToastAndroid.SHORT);
            } else {
                console.log('Adding New Item');
                await StorageService.addItem(itemData);
                setIsDuplicateCode(false);
                ToastAndroid.show('Item added successfully', ToastAndroid.SHORT);
            }

            navigation.goBack();
        } catch (error) {
            console.error('Save Item Error:', error);
            Alert.alert('Error', 'Failed to save item');
        } finally {
            setLoading(false);
        }
    };


    const isValidEAN = (code: string) => {

        if (!/^\d+$/.test(code)) return false;

        return code.length === 8 || code.length === 13;
    };


    const handleScanPress = async () => {
        if (Platform.OS === 'android') {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.CAMERA,
            );
            if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                setIsScanning(true);
            } else {
                Alert.alert('Permission Denied', 'Camera permission is required to scan barcodes');
            }
        } else {
            setIsScanning(true);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Header
                title={isEdit ? 'Edit Item' : 'Add Item'}
                subtitle={isEdit ? 'Update item details' : 'Create a new inventory item'}
                onBack={() => navigation.goBack()}
            // rightComponent={
            //     <TouchableOpacity onPress={handleSave} disabled={loading}>
            //         <Text style={styles.saveText}>{loading ? 'Saving...' : 'Save'}</Text>
            //     </TouchableOpacity>
            // }
            />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
            >

                <ScrollView
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 30 }}

                >
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>
                            Item Name <Text style={styles.required}>*</Text>
                        </Text>

                        <View
                            style={isMultiline ? styles.multiLineContainer : styles.inputContainer}
                        >
                            <Icon
                                name="tag-outline"
                                size={20}
                                color={COLORS.textSecondary}
                                style={styles.inputIcon}
                            />

                            <TextInput
                                style={[
                                    styles.input,
                                    isMultiline && { height: Math.max(48, inputHeight) },
                                ]}
                                value={name}
                                onChangeText={setName}
                                placeholder="e.g. Chicken Burger"
                                placeholderTextColor={COLORS.textSecondary}
                                multiline
                                textAlignVertical={isMultiline ? 'top' : 'center'}
                                onContentSizeChange={(e) => {
                                    const h = e.nativeEvent.contentSize.height;
                                    setInputHeight(h);
                                    setIsMultiline(h > 48);
                                }}
                            />
                        </View>
                    </View>


                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Category</Text>

                        <TouchableOpacity
                            style={styles.dropdownButton}
                            onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Icon name="shape-outline" size={20} color={COLORS.textSecondary} />
                                <Text style={[
                                    styles.dropdownButtonText,
                                    !categoryId && { color: COLORS.textSecondary }
                                ]}>
                                    {categoryId
                                        ? categories.find(c => c.id === categoryId)?.name
                                        : 'Select Category'}
                                </Text>
                            </View>
                            <Icon
                                name={showCategoryDropdown ? "chevron-up" : "chevron-down"}
                                size={24}
                                color={COLORS.textSecondary}
                            />
                        </TouchableOpacity>

                        {showCategoryDropdown && (
                            <View style={styles.dropdownContent}>
                                {categories.map(cat => (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[
                                            styles.dropdownItem,
                                            categoryId === cat.id && styles.dropdownItemSelected
                                        ]}
                                        onPress={() => {
                                            setCategoryId(cat.id);
                                            setShowCategoryDropdown(false);
                                        }}
                                    >
                                        <Text style={[
                                            styles.dropdownItemText,
                                            categoryId === cat.id && styles.dropdownItemTextSelected
                                        ]}>{cat.name}</Text>
                                        {categoryId === cat.id && (
                                            <Icon name="check" size={18} color={COLORS.primary} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity
                                    style={styles.dropdownAddItem}
                                    onPress={() => {
                                        setShowCategoryDropdown(false);
                                        navigation.navigate('CategoryMaster');
                                    }}
                                >
                                    <Icon name="plus" size={18} color={COLORS.primary} />
                                    <Text style={styles.dropdownAddItemText}>Add New Category</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Item Code <Text style={styles.required}>*</Text></Text>
                        <View
                            style={[
                                styles.inputContainer,
                                isDuplicateCode && { borderColor: COLORS.danger, borderWidth: 2 } // red border around container
                            ]}
                        >
                            <TouchableOpacity onPress={handleScanPress}>
                                <Icon
                                    name="barcode-scan"
                                    size={24}
                                    color={COLORS.primary}
                                    style={styles.inputIcon}
                                />
                            </TouchableOpacity>

                            <TextInput
                                style={styles.input}
                                value={code}
                                onChangeText={text => {
                                    setCode(text);
                                    if (isDuplicateCode) setIsDuplicateCode(false); // reset as user types
                                }}
                                placeholder="e.g. CB001"
                                placeholderTextColor={COLORS.textSecondary}
                                autoCapitalize="characters"
                            />
                        </View>

                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>MRP</Text>
                        <View style={styles.inputContainer}>
                            <FontAwesome name="rupee" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                value={mrp}
                                onChangeText={setMrp}
                                placeholder="0.00"
                                placeholderTextColor={COLORS.textSecondary}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    {/* <View style={styles.formGroup}>
                        <Text style={styles.label}>Rate</Text>
                        <View style={styles.inputContainer}>
                            <FontAwesome name="rupee" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                value={rate}
                                onChangeText={setRate}
                                placeholder="0.00"
                                placeholderTextColor={COLORS.textSecondary}
                                keyboardType="numeric"
                            />
                        </View>
                    </View> */}

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Price <Text style={styles.required}>*</Text></Text>
                        <View style={styles.inputContainer}>
                            {/* <Icon name="currency-usd" size={20} color={COLORS.textSecondary} style={styles.inputIcon} /> */}
                            <FontAwesome name="rupee" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />

                            <TextInput
                                style={styles.input}
                                value={price}
                                onChangeText={setPrice}
                                placeholder="0.00"
                                placeholderTextColor={COLORS.textSecondary}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Opening Stock</Text>
                        <View style={[styles.inputContainer, { minHeight: 50 }]}>
                            <Icon name="package-variant" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { paddingVertical: 8 }]}
                                value={stock}
                                onChangeText={setStock}
                                placeholder="0"
                                placeholderTextColor={COLORS.textSecondary}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>


                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Tax</Text>

                        <TouchableOpacity
                            style={styles.dropdownButton}
                            onPress={() => setShowTaxDropdown(!showTaxDropdown)}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Icon name="percent" size={20} color={COLORS.textSecondary} />
                                <Text style={[
                                    styles.dropdownButtonText,
                                    !selectedTaxId && { color: COLORS.textSecondary }
                                ]}>
                                    {selectedTaxId
                                        ? taxes.find(t => t.id === selectedTaxId)?.name
                                        : 'Select Tax'}
                                </Text>
                            </View>

                            <Icon
                                name={showTaxDropdown ? "chevron-up" : "chevron-down"}
                                size={24}
                                color={COLORS.textSecondary}
                            />
                        </TouchableOpacity>

                        {showTaxDropdown && (
                            <View style={styles.dropdownContent}>
                                {taxes.map(tax => (
                                    <TouchableOpacity
                                        key={tax.id}
                                        style={[
                                            styles.dropdownItem,
                                            selectedTaxId === tax.id && styles.dropdownItemSelected
                                        ]}
                                        onPress={() => {
                                            setSelectedTaxId(tax.id);
                                            setShowTaxDropdown(false);
                                        }}
                                    >
                                        <Text style={[
                                            styles.dropdownItemText,
                                            selectedTaxId === tax.id && styles.dropdownItemTextSelected
                                        ]}>
                                            {tax.name}
                                        </Text>

                                        {selectedTaxId === tax.id && (
                                            <Icon name="check" size={18} color={COLORS.primary} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>


                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Description</Text>
                        <View style={[styles.inputContainer, styles.textAreaContainer]}>
                            <Icon name="text" size={20} color={COLORS.textSecondary} style={[styles.inputIcon, styles.textAreaIcon]} />
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={description}
                                onChangeText={setDescription}
                                placeholder="Item description..."
                                placeholderTextColor={COLORS.textSecondary}
                                multiline
                                numberOfLines={4}
                                blurOnSubmit={false}
                            />
                        </View>
                    </View>
                </ScrollView>

            </KeyboardAvoidingView>

            {/* <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleSave}
                    disabled={loading}
                >
                    <Text style={styles.buttonText}>{isEdit ? 'Update Item' : 'Create Item'}</Text>
                </TouchableOpacity>
            </View> */}

            <Modal
                visible={isScanning}
                animationType="slide"
                onRequestClose={() => setIsScanning(false)}
                presentationStyle="fullScreen"
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
                    <View style={styles.scannerHeader}>
                        <Text style={styles.scannerTitle}>Scan Barcode</Text>
                        <TouchableOpacity onPress={() => setIsScanning(false)} style={styles.closeButton}>
                            <Icon name="close" size={28} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    <Camera
                        scanBarcode={true}
                        onReadCode={onBarcodeScan}
                        showFrame={true}
                        laserColor={COLORS.primary}
                        frameColor="#fff"
                        style={{ flex: 1 }}
                    />

                </SafeAreaView>
            </Modal>

            <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
                <View style={styles.footerRow}>
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => navigation.goBack()}
                        disabled={loading}
                    >
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.primaryButton, loading && styles.buttonDisabled]}
                        onPress={handleSave}
                        disabled={loading}
                    >
                        <Text style={styles.primaryText}>
                            {isEdit ? 'Update Item' : 'Create Item'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>



            {/* Barcode Scanner Modal */}
            <Modal
                visible={isScanning}
                animationType="slide"
                onRequestClose={() => setIsScanning(false)}
                presentationStyle="fullScreen"
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
                    <View style={styles.scannerHeader}>
                        <Text style={styles.scannerTitle}>Scan Barcode</Text>
                        <TouchableOpacity onPress={() => setIsScanning(false)} style={styles.closeButton}>
                            <Icon name="close" size={28} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    <Camera
                        scanBarcode={true}
                        onReadCode={onBarcodeScan}
                        showFrame={true}
                        laserColor={COLORS.primary}
                        frameColor="#fff"
                        style={{ flex: 1 }}
                    />
                </SafeAreaView>
            </Modal>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        flex: 1,
        padding: SIZES.large,
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 8,
    },
    required: {
        color: COLORS.danger,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: SIZES.radius,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 12,
        height: 50,
    },
    multiLineContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: SIZES.radius,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },


    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: COLORS.textPrimary,
        fontSize: 16,
    },
    textAreaContainer: {
        height: 120,
        alignItems: 'flex-start',
        paddingVertical: 12,
    },
    textAreaIcon: {
        marginTop: 4,
    },
    textArea: {
        height: '100%',
        textAlignVertical: 'top',
    },
    saveText: {
        color: COLORS.primary,
        fontWeight: '700',
        fontSize: 16,
    },
    // footer: {
    //     padding: SIZES.large,
    //     backgroundColor: COLORS.surface,
    //     borderTopWidth: 1,
    //     borderTopColor: COLORS.border,

    // },
    footer: {
        padding: SIZES.large,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },

    footerRow: {
        flexDirection: 'row',
        gap: 12,
    },


    cancelButton: {
        flex: 1,
        height: 50,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surface,
    },

    dropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        height: 48,
        paddingHorizontal: 12,
    },
    dropdownButtonText: {
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    dropdownContent: {
        marginTop: 8,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        overflow: 'hidden',
        ...SHADOWS.small,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border + '40',
    },
    dropdownItemSelected: {
        backgroundColor: COLORS.primary + '10',
    },
    dropdownItemText: {
        fontSize: 15,
        color: COLORS.textPrimary,
    },
    dropdownItemTextSelected: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    dropdownAddItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: COLORS.background,
    },
    dropdownAddItemText: {
        fontSize: 15,
        color: COLORS.primary,
        fontWeight: '600',
    },

    primaryButton: {
        flex: 1,
        height: 50,
        backgroundColor: COLORS.primary,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },

    buttonDisabled: {
        opacity: 0.6,
    },

    cancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },


    primaryText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    scannerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1,
    },
    scannerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    closeButton: {
        padding: 4,
    },
});

export default ItemFormScreen;