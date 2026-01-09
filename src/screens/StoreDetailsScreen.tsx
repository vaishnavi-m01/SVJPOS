import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Alert,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { COLORS, SIZES, SHADOWS } from '../styles/theme';
import Header from '../components/Header';
import StorageService from '../services/StorageService';
import { StoreDetails } from '../types';
import { useNavigation } from '@react-navigation/native';

const StoreDetailsScreen = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(false);
    const [store, setStore] = useState<StoreDetails>({
        name: '',
        location: '',
        phone: '',
    });
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        loadStoreDetails();
    }, []);

    const loadStoreDetails = async () => {
        // 1. Try to fetch from explicit store details
        let details = await StorageService.getStoreDetails();

        // 2. If name is missing, try to fallback to current user's business name
        if (!details.name) {
            const user = await StorageService.getCurrentUser();
            if (user?.businessName) {
                details = { ...details, name: user.businessName };
            }
        }
        setStore(details);
    };

    const handleSave = async () => {
        const newErrors: { [key: string]: string } = {};

        if (!store.name.trim()) {
            newErrors.name = 'Store name is required';
        }

        if (!store.location.trim()) {
            newErrors.location = 'Address is required';
        }

        if (!store.phone.trim()) {
            newErrors.phone = 'Phone number is required';
        } else {
            const phoneClean = store.phone.replace(/[^0-9]/g, '');
            if (phoneClean.length < 10) {
                newErrors.phone = 'Invalid phone number';
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});

        setLoading(true);
        const success = await StorageService.saveStoreDetails(store);
        setLoading(false);

        if (success) {
            Alert.alert('Success', 'Store details updated!');
            navigation.goBack();
        } else {
            Alert.alert('Error', 'Failed to save store details');
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Header
                title="Store Details"
                subtitle="Manage your business info"
                onBack={() => navigation.goBack()}
            />

            <KeyboardAwareScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.content}
                enableOnAndroid={true}
                extraScrollHeight={20}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Card */}
                <View style={styles.heroCard}>
                    <View style={styles.iconCircle}>
                        <Icon name="store" size={40} color={COLORS.primary} />
                    </View>
                    <Text style={styles.heroTitle}>{store.name || 'Your Store'}</Text>
                    <Text style={styles.heroSubtitle}>
                        These details will appear on your receipts
                    </Text>
                </View>

                {/* Form Section */}
                <View style={styles.formSection}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Business Name</Text>
                        <View style={[styles.inputContainer, errors.name && styles.inputError]}>
                            <Icon name="domain" size={20} color={errors.name ? COLORS.danger : COLORS.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                value={store.name}
                                onChangeText={(text) => {
                                    setStore({ ...store, name: text });
                                    if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                                }}
                                placeholder="e.g. My Awesome Shop"
                                placeholderTextColor={COLORS.textSecondary}
                                maxLength={50}
                            />
                        </View>
                        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Address / Location</Text>
                        <View style={[styles.inputContainer, styles.textAreaContainer, errors.location && styles.inputError]}>
                            <Icon name="map-marker" size={20} color={errors.location ? COLORS.danger : COLORS.textSecondary} style={[styles.inputIcon, { marginTop: 12 }]} />
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={store.location}
                                onChangeText={(text) => {
                                    setStore({ ...store, location: text });
                                    if (errors.location) setErrors(prev => ({ ...prev, location: '' }));
                                }}
                                placeholder="e.g. 123 Main St, New York, NY"
                                placeholderTextColor={COLORS.textSecondary}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                                maxLength={100}
                            />
                        </View>
                        {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Phone Number</Text>
                        <View style={[styles.inputContainer, errors.phone && styles.inputError]}>
                            <Icon name="phone" size={20} color={errors.phone ? COLORS.danger : COLORS.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                value={store.phone}
                                onChangeText={(text) => {
                                    const cleaned = text.replace(/[^0-9]/g, '');
                                    setStore({ ...store, phone: cleaned });
                                    if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                                }}
                                placeholder="e.g. 1234567890"
                                placeholderTextColor={COLORS.textSecondary}
                                keyboardType="numeric"
                                maxLength={10}
                            />
                        </View>
                        {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
                    </View>
                </View>

                {/* Save Button inside ScrollView to ensure accessibility */}
                <View style={styles.footer}>
                    <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
                        {loading ? (
                            <Text style={styles.saveButtonText}>Saving...</Text>
                        ) : (
                            <>
                                <Icon name="content-save" size={20} color="#fff" />
                                <Text style={styles.saveButtonText}>Save Details</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAwareScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        padding: 20,
        paddingBottom: 80,
    },
    heroCard: {
        alignItems: 'center',
        marginBottom: 30,
        marginTop: 10,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.primary + '15',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.primary + '30',
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 8,
    },
    heroSubtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    formSection: {
        gap: 20,
        marginBottom: 30,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginLeft: 4,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 12,
        ...SHADOWS.small,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        height: 50,
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    textAreaContainer: {
        height: 100,
        alignItems: 'flex-start',
    },
    textArea: {
        height: 100,
        paddingTop: 12,
    },
    footer: {
        marginTop: 10,
    },
    saveButton: {
        backgroundColor: COLORS.primary,
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        ...SHADOWS.medium,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
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
});

export default StoreDetailsScreen;
