import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { ScrollView } from 'react-native-gesture-handler';

import { COLORS, SIZES } from '../styles/theme';
import Header from '../components/Header';
import { RootStackParamList, Tax } from '../types';
import StorageService from '../services/StorageService';

type TaxFormNavProp = NativeStackNavigationProp<
    RootStackParamList,
    'TaxForm'
>;
type TaxFormRouteProp = RouteProp<
    RootStackParamList,
    'TaxForm'
>;

interface Props {
    navigation: TaxFormNavProp;
    route: TaxFormRouteProp;
}

const TaxFormScreen: React.FC<Props> = ({ navigation, route }) => {
    const editingTax = route.params?.tax;
    const insets = useSafeAreaInsets();

    const [name, setName] = useState('');
    const [rate, setRate] = useState('');
    const [description, setDescription] = useState('');
    const [isDefault, setIsDefault] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (editingTax) {
            setName(editingTax.name);
            setRate(editingTax.rate.toString());
            setDescription(editingTax.description);
            setIsDefault(editingTax.isDefault);
        }
    }, [editingTax]);

    const saveTax = async (taxes: Tax[]) => {
        // remove old default if new one is default
        if (isDefault) {
            taxes = taxes.map(t => ({
                ...t,
                isDefault: false,
            }));
        }

        const taxObj: Tax = {
            id: editingTax?.id ?? Date.now().toString(),
            name,
            rate: parseFloat(rate),
            description,
            isDefault,
        };

        const index = taxes.findIndex(t => t.id === taxObj.id);

        if (index >= 0) {
            taxes[index] = taxObj;
        } else {
            taxes.push(taxObj);
        }

        await StorageService.saveTaxes(taxes);
        setLoading(false);
        navigation.goBack();
    };


    const handleSave = async () => {
        const newErrors: { [key: string]: string } = {};

        if (!name.trim()) {
            newErrors.name = 'Tax name is required';
        }

        if (!rate.trim()) {
            newErrors.rate = 'Tax rate is required';
        } else {
            const numRate = parseFloat(rate);
            if (isNaN(numRate)) {
                newErrors.rate = 'Invalid rate';
            } else if (numRate > 100) {
                newErrors.rate = 'Tax rate cannot exceed 100%';
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});

        try {
            let taxes = await StorageService.getTaxes();

            // 🔍 Check for duplicate name
            const isDuplicate = taxes.some(t =>
                t.name.trim().toLowerCase() === name.trim().toLowerCase() &&
                t.id !== editingTax?.id
            );

            if (isDuplicate) {
                setErrors(prev => ({ ...prev, name: 'Tax with this name already exists' }));
                setLoading(false);
                return;
            }

            // 🔍 check already default tax exists or not
            const existingDefault = taxes.find(
                t => t.isDefault && t.id !== editingTax?.id
            );

            // ⚠️ show alert if another default exists
            if (isDefault && existingDefault) {
                Alert.alert(
                    'Default Tax Change',
                    'Already one default tax exists. It will be replaced.',
                    [
                        {
                            text: 'OK',
                            onPress: async () => {
                                saveTax(taxes);
                            },
                        },
                    ]
                );
            } else {
                await saveTax(taxes);
            }
        } catch {
            Alert.alert('Error', 'Failed to save tax');
            setLoading(false);
        }
    };


    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Header
                title={editingTax ? 'Edit Tax' : 'Add Tax'}
                onBack={() => navigation.goBack()}
            />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
            >
                <ScrollView
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: 140 + insets.bottom },
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Name */}
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Name <Text style={{ color: "red" }}>*</Text></Text>
                        <View style={[styles.inputContainer, errors.name && styles.inputError]}>
                            <Icon name="receipt" size={20} color={errors.name ? COLORS.danger : COLORS.textSecondary} />
                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={(text) => {
                                    setName(text);
                                    if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                                }}
                                placeholder="e.g. VAT"
                                maxLength={30}
                            />
                        </View>
                        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
                    </View>

                    {/* Rate */}
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Rate  <Text style={{ color: "red" }}>*</Text></Text>
                        <View style={[styles.inputContainer, errors.rate && styles.inputError]}>
                            <Icon name="percent" size={20} color={errors.rate ? COLORS.danger : COLORS.textSecondary} />
                            <TextInput
                                style={styles.input}
                                value={rate}
                                onChangeText={text => {
                                    // allow only numbers and decimal
                                    const cleaned = text.replace(/[^0-9.]/g, '');

                                    // allow only one decimal
                                    if ((cleaned.match(/\./g) || []).length > 1) return;

                                    // allow max 2 decimal places
                                    const parts = cleaned.split('.');
                                    if (parts[1] && parts[1].length > 2) return;

                                    setRate(cleaned);
                                    if (errors.rate) setErrors(prev => ({ ...prev, rate: '' }));
                                }}
                                placeholder="e.g. 5 or 5.50"
                                keyboardType="decimal-pad"
                                maxLength={6} // 100.00
                            />

                        </View>
                        {errors.rate && <Text style={styles.errorText}>{errors.rate}</Text>}
                    </View>

                    {/* Description */}
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Description</Text>
                        <View style={[styles.inputContainer, styles.textAreaContainer]}>
                            <Icon name="text" size={20} color={COLORS.textSecondary} style={styles.textAreaIcon} />
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={description}
                                onChangeText={setDescription}
                                placeholder="Optional"
                                maxLength={50}
                                multiline
                                numberOfLines={5}
                                textAlignVertical="top"
                            />
                        </View>
                    </View>

                    {/* Default */}
                    <View style={styles.toggleRow}>
                        <TouchableOpacity onPress={() => setIsDefault(!isDefault)}>
                            <Icon
                                name={
                                    isDefault
                                        ? 'checkbox-marked'
                                        : 'checkbox-blank-outline'
                                }
                                size={24}
                                color={COLORS.primary}
                            />
                        </TouchableOpacity>
                        <Text style={styles.toggleLabel}>Default Tax</Text>

                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <View
                style={[
                    styles.footer,
                    { paddingBottom: insets.bottom + 10 },
                ]}
            >
                <View style={styles.footerRow}>
                    {/* Cancel */}
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => navigation.goBack()}
                        disabled={loading}
                    >
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>

                    {/* Save */}
                    <TouchableOpacity
                        style={[
                            styles.saveButton,
                            loading && styles.buttonDisabled,
                        ]}
                        onPress={handleSave}
                        disabled={loading}
                    >
                        <Text style={styles.saveText}>
                            {loading ? 'Saving...' : 'Save'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
};

export default TaxFormScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        padding: 20,
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 48,
        backgroundColor: COLORS.surface,
        borderColor: COLORS.border,
    },
    input: {
        flex: 1,
        marginLeft: 10,

    },
    toggleRow: {
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
    },
    toggleLabel: {
        fontSize: 16,
    },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        padding: SIZES.large,
    },


    footerRow: {
        flexDirection: 'row',
        gap: 12, // RN >= 0.71
    },

    cancelButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: COLORS.primary,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        backgroundColor: 'transparent',
    },

    cancelText: {
        color: COLORS.primary,
        fontWeight: '700',
        fontSize: 16,
    },

    saveButton: {
        flex: 1,
        backgroundColor: COLORS.primary,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
    },

    saveText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },

    buttonDisabled: {
        opacity: 0.6,
    },
    inputError: {
        borderColor: COLORS.danger,
        borderWidth: 1.5,
    },
    errorText: {
        color: COLORS.danger,
        fontSize: 12,
        marginTop: 4,
        marginLeft: 4,
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
    },
});
