import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Alert,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Animated,
    ScrollView,
    Image,
    Linking,
    ToastAndroid,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, SIZES } from '../styles/theme';
import Button from '../components/Button';
import StorageService from '../services/StorageService';
import BiometricService from '../services/BiometricService';
import { RootStackParamList } from '../types';
import RBSheet from 'react-native-raw-bottom-sheet';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

interface LoginScreenProps {
    navigation: LoginScreenNavigationProp;
}

interface RBSheetRef {
    open: () => void;
    close: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
    const [isLogin, setIsLogin] = useState(true);

    // Login & Register states
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    const [registerUsername, setRegisterUsername] = useState('');
    const [registerEmail, setRegisterEmail] = useState('');
    const [registerPassword, setRegisterPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [businessName, setBusinessName] = useState('');

    const email = isLogin ? loginEmail : registerEmail;
    const password = isLogin ? loginPassword : registerPassword;

    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [fadeAnim] = useState(new Animated.Value(0));
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [fingerprintEnabled, setFingerprintEnabled] = useState(false);
    const [biometricLoading, setBiometricLoading] = useState(false);

    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');

    const forgotSheetRef = useRef<RBSheetRef>(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
        }).start();
        checkBiometricAvailability();
    }, []);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', async () => {
            // Check biometric availability
            try {
                const { available } = await BiometricService.isBiometricAvailable();

                // Auto-trigger fingerprint if one-time login was completed
                const hasCompleted = await BiometricService.hasCompletedBiometricSetup();

                if (available && hasCompleted) {
                    // Add a slight delay to ensure UI is ready
                    setTimeout(() => {
                        handleFingerprintLoginPressed();
                    }, 300);
                }

                // Update UI state
                setBiometricAvailable(available);
                if (available) {
                    const isEnabled = await BiometricService.isFingerprintEnabled();
                    setFingerprintEnabled(isEnabled);
                }
            } catch (error) {
                console.error('Error checking biometric setup:', error);
            }
        });
        return unsubscribe;
    }, [navigation]);

    const resetRegisterForm = () => {
        setRegisterUsername('');
        setRegisterEmail('');
        setRegisterPassword('');
        setConfirmPassword('');
        setBusinessName('');
        setEmailError('');
        setPasswordError('');
        setConfirmPasswordError('');
    };

    const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const checkBiometricAvailability = async () => {
        try {
            const { available } = await BiometricService.isBiometricAvailable();
            setBiometricAvailable(available);
            if (available) {
                const isEnabled = await BiometricService.isFingerprintEnabled();
                setFingerprintEnabled(isEnabled);
            }
        } catch (error) {
            console.error('Error checking biometric:', error);
        }
    };

    const handlePasswordChange = (text: string) => {
        if (isLogin) setLoginPassword(text);
        else setRegisterPassword(text);

        if (!text) setPasswordError('Password is required');
        else if (text.length < 6) setPasswordError('Password must be at least 6 characters');
        else setPasswordError('');

        if (confirmPassword && text !== confirmPassword) setConfirmPasswordError('Passwords do not match');
        else setConfirmPasswordError('');
    };

    const handleConfirmPasswordChange = (text: string) => {
        setConfirmPassword(text);
        if (!text) setConfirmPasswordError('Confirm password is required');
        else if (text !== password) setConfirmPasswordError('Passwords do not match');
        else setConfirmPasswordError('');
    };

    const handleEmailChange = (text: string) => {
        if (isLogin) setLoginEmail(text);
        else setRegisterEmail(text);

        if (!text.trim()) setEmailError('Email is required');
        else if (!validateEmail(text.trim())) setEmailError('Invalid email format');
        else setEmailError('');
    };

    const handleUsernameChange = (text: string) => {
        if (!isLogin) {
            setRegisterUsername(text);
        }
    };

    const handleAuth = async () => {
        if (!email || !password || (!isLogin && !confirmPassword)) {
            Alert.alert('Error', 'Please fill all required fields');
            return;
        }
        if (emailError || passwordError || confirmPasswordError) {
            Alert.alert('Error', 'Please fix validation errors');
            return;
        }
        if (!isLogin && !businessName.trim()) {
            Alert.alert('Error', 'Please enter business name');
            return;
        }

        setLoading(true);
        try {
            if (isLogin) {
                const users = await StorageService.getUsers();
                const user = users.find(u => u.email === email && u.password === password);

                if (user) {
                    Alert.alert(
                        'Enable Fingerprint?',
                        'Use fingerprint for next login?',
                        [
                            {
                                text: 'No',
                                onPress: async () => {
                                    await StorageService.setCurrentUser(user);
                                    navigation.replace('Tabs');
                                }
                            },
                            {
                                text: 'Yes',
                                onPress: async () => {
                                    const { available, error } = await BiometricService.isBiometricAvailable();

                                    if (!available) {
                                        // Ensure we check exactly why it's not available
                                        Alert.alert(
                                            'Fingerprint Not Set',
                                            'You have not set up a fingerprint on your phone. Go to Settings?',
                                            [
                                                { text: 'No', style: 'cancel', onPress: () => navigation.replace('Tabs') },
                                                {
                                                    text: 'Yes',
                                                    onPress: () => {
                                                        if (Platform.OS === 'android') {
                                                            Linking.sendIntent('android.settings.SECURITY_SETTINGS');
                                                        } else {
                                                            Linking.openSettings();
                                                        }
                                                        // Stay on login screen so they can retry after setting up
                                                    }
                                                }
                                            ]
                                        );
                                        return;
                                    }

                                    await BiometricService.enableFingerprint(user.email);
                                    await StorageService.setCurrentUser(user);
                                    navigation.replace('Tabs');
                                }
                            }
                        ]
                    );
                } else {
                    Alert.alert('Error', 'Invalid credentials');
                }
            } else {
                const users = await StorageService.getUsers();
                if (users.find(u => u.email === email)) {
                    Alert.alert('Error', 'Email already exists');
                    return;
                }
                const newUser = {
                    id: Date.now().toString(),
                    username: registerUsername,
                    email,
                    password,
                    businessName,
                };
                await StorageService.saveUser(newUser);
                await StorageService.setCurrentUser(newUser);

                await StorageService.saveStoreDetails({
                    name: businessName,
                    location: '',
                    phone: '',
                });

                await StorageService.saveProfile({
                    name: registerUsername,
                    email: email,
                });
                navigation.replace('Tabs');
            }
        } catch (error) {
            Alert.alert('Error', 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const handleFingerprintLoginPressed = async () => {
        try {
            setBiometricLoading(true);
            const email = await BiometricService.authenticate();
            if (!email) {
                setBiometricLoading(false);
                return;
            }

            // Get user details and set as current user
            const users = await StorageService.getUsers();
            const user = users.find(u => u.email === email);

            if (user) {
                await StorageService.setCurrentUser(user);
                setBiometricLoading(false);
                navigation.replace('Tabs');
            } else {
                setBiometricLoading(false);
                Alert.alert('Error', 'User not found');
            }
        } catch (error) {
            setBiometricLoading(false);
            console.error('Biometric error:', error);
            Alert.alert('Fingerprint Authentication', 'Fingerprint authentication cancelled or failed');
        }
    };

    const handleForgotPasswordPress = async () => {
        if (!loginEmail.trim()) {
            if (Platform.OS === 'android') {
                ToastAndroid.show('please enter a email', ToastAndroid.SHORT);
            }
            setEmailError('enter a email');
            return;
        }

        const users = await StorageService.getUsers();
        const userExists = users.some(u => u.email.toLowerCase() === loginEmail.trim().toLowerCase());

        if (!userExists) {
            if (Platform.OS === 'android') {
                ToastAndroid.show('Invalid email valid mail', ToastAndroid.SHORT);
            }
            setEmailError('Invalid email valid mail');
            return;
        }

        setEmailError('');
        forgotSheetRef.current?.open();
    };

    const handleResetPassword = async () => {
        if (!email || !newPassword || !confirmNewPassword) {
            Alert.alert('Error', 'All fields are required');
            return;
        }
        if (newPassword.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }
        if (newPassword !== confirmNewPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        const success = await StorageService.updateUserPassword(email, newPassword);

        if (!success) {
            Alert.alert('Error', 'User not found');
            return;
        }

        Alert.alert('Success', 'Password reset successful');
        forgotSheetRef.current?.close();
        setNewPassword('');
        setConfirmNewPassword('');
    };


    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.header}>
                            <Image source={require('../assets/images/SvjAppLogo.png')} style={styles.logoImage} />
                            <Text style={styles.title}>SVJPOS</Text>
                            <Text style={styles.subtitle}>Professional Point of Sale</Text>
                        </View>

                        <Animated.View style={[styles.form, { transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] }]}>
                            <View style={styles.tabContainer}>
                                <TouchableOpacity style={[styles.tab, isLogin && styles.activeTab]} onPress={() => setIsLogin(true)} disabled={loading}>
                                    <Icon name="login" size={20} color={isLogin ? '#fff' : COLORS.textSecondary} />
                                    <Text style={[styles.tabText, isLogin && styles.activeTabText]}>Login</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.tab, !isLogin && styles.activeTab]} onPress={() => { setIsLogin(false); resetRegisterForm(); }} disabled={loading}>
                                    <Icon name="account-plus" size={20} color={!isLogin ? '#fff' : COLORS.textSecondary} />
                                    <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>Register</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Login Email */}
                            {isLogin && (
                                <View style={styles.inputContainer}>
                                    <Icon name="email" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Email"
                                        placeholderTextColor={COLORS.textSecondary}
                                        value={loginEmail}
                                        onChangeText={handleEmailChange}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                    />
                                </View>
                            )}
                            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

                            {/* Register Username & Email */}
                            {!isLogin && (
                                <>
                                    <View style={styles.inputContainer}>
                                        <Icon name="account" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Username"
                                            value={registerUsername}
                                            onChangeText={handleUsernameChange}
                                            maxLength={30}

                                        />
                                    </View>
                                    <View style={styles.inputContainer}>
                                        <Icon name="email" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Email"
                                            value={registerEmail}
                                            onChangeText={handleEmailChange}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                        />
                                    </View>
                                </>
                            )}

                            {/* Password */}
                            <View style={styles.inputContainer}>
                                <Icon name="lock" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Password"
                                    value={password}
                                    placeholderTextColor={COLORS.textSecondary}
                                    onChangeText={handlePasswordChange}
                                    secureTextEntry={!showPassword}
                                    editable={!loading}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon} disabled={loading}>
                                    <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.textSecondary} />
                                </TouchableOpacity>
                            </View>
                            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

                            {/* Register Confirm Password & Business Name */}
                            {!isLogin && (
                                <>
                                    <View style={styles.inputContainer}>
                                        <Icon name="lock-check" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Confirm Password"
                                            value={confirmPassword}
                                            onChangeText={handleConfirmPasswordChange}
                                            placeholderTextColor={COLORS.textSecondary}
                                            secureTextEntry={!showConfirmPassword}
                                            editable={!loading}
                                        />
                                        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon} disabled={loading}>
                                            <Icon name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.textSecondary} />
                                        </TouchableOpacity>
                                    </View>
                                    {confirmPasswordError ? <Text style={styles.errorText}>{confirmPasswordError}</Text> : null}

                                    <View style={styles.inputContainer}>
                                        <Icon name="office-building" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Business Name"
                                            value={businessName}
                                            onChangeText={setBusinessName}
                                            editable={!loading}
                                            maxLength={50}
                                        />
                                    </View>
                                </>
                            )}

                            {/* Fingerprint */}
                            {isLogin && biometricAvailable && fingerprintEnabled && (
                                <TouchableOpacity style={[styles.fingerprintButton, fingerprintEnabled && styles.fingerprintButtonProminent]} onPress={handleFingerprintLoginPressed} disabled={biometricLoading || loading}>
                                    {biometricLoading ? (
                                        <ActivityIndicator color="#fff" size={20} />
                                    ) : (
                                        <View style={styles.fingerprintButtonContent}>
                                            <Icon name="fingerprint" size={24} color="#fff" />
                                            <Text style={styles.fingerprintTitle}>Login with Fingerprint</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            )}

                            <View style={styles.buttonContainer}>
                                {loading && <ActivityIndicator color={COLORS.primary} style={styles.loader} />}
                                <Button title={isLogin ? 'Login' : 'Register'} onPress={handleAuth} style={styles.button} disabled={loading} />
                            </View>

                            {isLogin && (
                                <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPasswordPress}>
                                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                                </TouchableOpacity>
                            )}
                        </Animated.View>
                    </ScrollView>
                </Animated.View>
            </KeyboardAvoidingView>

            {/* Forgot Password Modal */}
            <RBSheet
                ref={forgotSheetRef}
                height={380}
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
                <Text style={styles.rbTitle}>Reset Password</Text>
                <View style={[styles.rbInputContainer, { backgroundColor: '#f8fafc' }]}>
                    <TextInput
                        style={[styles.rbInput, { flex: 1, borderWidth: 0, marginBottom: 0 }]}
                        placeholder="Email"
                        value={loginEmail}
                        editable={false}
                    />
                </View>
                <View style={styles.rbInputContainer}>
                    <TextInput
                        style={[styles.rbInput, { flex: 1, borderWidth: 0, marginBottom: 0 }]}
                        placeholder="New Password"
                        secureTextEntry={!showPassword}
                        value={newPassword}
                        onChangeText={setNewPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                        <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                </View>
                <View style={styles.rbInputContainer}>
                    <TextInput
                        style={[styles.rbInput, { flex: 1, borderWidth: 0, marginBottom: 0 }]}
                        placeholder="Confirm Password"
                        secureTextEntry={!showConfirmPassword}
                        value={confirmNewPassword}
                        onChangeText={setConfirmNewPassword}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                        <Icon name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.rbSaveButton} onPress={handleResetPassword}>
                    <Text style={styles.rbSaveText}>Reset Password</Text>
                </TouchableOpacity>
            </RBSheet>
        </SafeAreaView>
    );
};

export default LoginScreen;


const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.primary,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: SIZES.large,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingBottom: 50,
    },
    header: {
        alignItems: 'center',
        marginBottom: SIZES.xlarge,
    },
    logoImage: {
        width: 80,
        height: 80,
        resizeMode: 'contain',
        borderRadius: 40
    },

    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SIZES.medium,
    },
    title: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: SIZES.small,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    subtitle: {
        fontSize: 18,
        color: '#fff',
        opacity: 0.9,
        fontWeight: '500',
    },
    form: {
        backgroundColor: '#fff',
        borderRadius: SIZES.radius * 2,
        padding: SIZES.large,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    tabContainer: {
        flexDirection: 'row',
        marginBottom: SIZES.large,
        backgroundColor: COLORS.background,
        borderRadius: SIZES.radius,
        padding: 4,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: SIZES.radius - 4,
        gap: 8,
    },
    activeTab: {
        backgroundColor: COLORS.primary,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    activeTabText: {
        color: '#fff',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: SIZES.radius,
        marginBottom: SIZES.medium,
        paddingHorizontal: SIZES.medium,
    },
    inputIcon: {
        marginRight: SIZES.small,
    },
    input: {
        flex: 1,
        paddingVertical: Platform.OS === 'android' ? 10 : SIZES.medium,
        fontSize: 16,
        color: COLORS.textPrimary,
        includeFontPadding: false,

    },
    eyeIcon: {
        marginLeft: SIZES.small,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: SIZES.medium,
        gap: SIZES.small,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.border,
    },
    dividerText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    fingerprintButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',   // ✅ IMPORTANT
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: SIZES.radius,
        borderWidth: 1,
        borderColor: COLORS.primary,
        backgroundColor: 'rgba(10, 126, 164, 0.05)',
        marginBottom: SIZES.medium,
        width: '100%',
    },

    fingerprintButtonProminent: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    fingerprintButtonDisabled: {
        borderColor: COLORS.border,
        backgroundColor: 'rgba(226, 232, 240, 0.7)',
    },

    fingerprintButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    fingerprintButtonText: {
        alignItems: 'center',
        textAlign: "center"
    },
    fingerprintTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    fingerprintTitleDisabled: {
        color: COLORS.textSecondary,
    },
    fingerprintSubtitle: {
        fontSize: 10,
        color: COLORS.textSecondary,
    },
    button: {
        marginTop: SIZES.medium,
        height: 55,
        borderRadius: SIZES.radius,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
        paddingBottom: SIZES.medium
    },
    buttonContainer: {
        position: 'relative',
    },
    loader: {
        position: 'absolute',
        top: 15,
        left: '50%',
        marginLeft: -10,
        zIndex: 1,
    },
    errorText: {
        color: 'red',
        fontSize: 12,
        marginBottom: 8,
        marginLeft: 4,
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: SIZES.medium,
    },

    forgotPasswordText: {
        fontSize: 13,
        color: COLORS.primary,
        fontWeight: '500',
        marginTop: SIZES.small
    },
    // forgotPassword: {
    //     alignSelf: 'flex-end',
    //     marginBottom: SIZES.medium,
    // },

    // forgotPasswordText: {
    //     color: COLORS.primary,
    //     fontSize: 13,
    //     fontWeight: '600',
    // },

    rbSheetContainer: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
    },

    rbDragIcon: {
        backgroundColor: '#ccc',
        width: 60,
    },

    rbTitle: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 20,
    },

    rbInput: {
        padding: 12,
        fontSize: 16,
        color: COLORS.textPrimary,
    },

    rbInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 10,
        marginBottom: 14,
        paddingRight: 12,
    },

    rbSaveButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },

    rbSaveText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },



});
