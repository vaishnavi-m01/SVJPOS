import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, SIZES, SHADOWS } from '../styles/theme';
import Header from '../components/Header';
import StorageService from '../services/StorageService';
import BiometricService from '../services/BiometricService';
import RBSheet from 'react-native-raw-bottom-sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';
import { SecuritySettings } from '../types';

import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RootStackParamList, RootTabParamList } from '../types';

type PrivacySecurityScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'AccountTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface PrivacySecurityScreenProps {
  navigation: PrivacySecurityScreenNavigationProp;
}

const PrivacySecurityScreen: React.FC<PrivacySecurityScreenProps> = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [biometricAuth, setBiometricAuth] = useState(false);

  // Change Password State
  const refRBSheet = useRef<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SECURITY_SETTINGS);
      if (stored) {
        const settings: SecuritySettings = JSON.parse(stored);
        setBiometricAuth(settings.biometricAuth);
      }

      // Also sync biometric state from BiometricService
      const isBioEnabled = await BiometricService.isFingerprintEnabled();
      setBiometricAuth(isBioEnabled);
    } catch (error) {
      console.error('Error loading security settings:', error);
    }
  };

  const saveSettings = async (updates: Partial<SecuritySettings>) => {
    try {
      const current: SecuritySettings = {
        biometricAuth,
      };
      const updated = { ...current, ...updates };
      await AsyncStorage.setItem(STORAGE_KEYS.SECURITY_SETTINGS, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving security settings:', error);
    }
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      const user = await StorageService.getCurrentUser();
      if (!user) {
        Alert.alert('Error', 'User session not found');
        return;
      }

      const { available } = await BiometricService.isBiometricAvailable();
      if (!available) {
        Alert.alert('Not Available', 'Biometric hardware not found or not setup on this device.');
        return;
      }

      const success = await BiometricService.enableFingerprint(user.email);
      if (success) {
        setBiometricAuth(true);
        saveSettings({ biometricAuth: true });
      }
    } else {
      await BiometricService.disableBiometric();
      setBiometricAuth(false);
      saveSettings({ biometricAuth: false });
    }
  };

  const SettingItem = ({
    icon,
    title,
    subtitle,
    onPress,
    color = COLORS.textSecondary,
    rightElement,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    color?: string;
    rightElement?: React.ReactNode;
  }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress && !rightElement}>
      <View style={[styles.settingIcon, { backgroundColor: color + '15' }]}>
        <Icon name={icon} size={22} color={color} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (
        <Icon name="chevron-right" size={20} color={COLORS.border} />
      )}
    </TouchableOpacity>
  );

  const handleChangePassword = () => {
    setErrors({});
    setNewPassword('');
    setConfirmNewPassword('');
    refRBSheet.current?.open();
  };

  const handleSavePassword = async () => {
    const newErrors: { [key: string]: string } = {};
    if (!newPassword) newErrors.new = 'New password is required';
    else if (newPassword.length < 6) newErrors.new = 'Must be at least 6 characters';
    if (newPassword !== confirmNewPassword) newErrors.confirm = 'Passwords do not match';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    const user = await StorageService.getCurrentUser();

    if (user) {
      setLoading(false); // Move it before the alert since alert blocks
      const success = await StorageService.updateUserPassword(user.email, newPassword);
      if (success) {
        Alert.alert(
          'Success',
          'Password updated successfully! Please login again with your new password.',
          [
            {
              text: 'OK',
              onPress: async () => {
                await StorageService.logout();
                refRBSheet.current?.close();
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' } as any],
                });
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to update password');
      }
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="Privacy & Security"
        icon="shield-check"
        subtitle="Manage your account security"
        onBack={() => navigation.goBack()}
      />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Security Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.sectionContent}>
            <SettingItem
              icon="lock"
              title="Change Password"
              subtitle="Update your account password"
              color={COLORS.primary}
              onPress={handleChangePassword}
            />
            <SettingItem
              icon="fingerprint"
              title="Biometric Authentication"
              subtitle="Use fingerprint for faster login"
              color={COLORS.accent}
              rightElement={
                <Switch
                  value={biometricAuth}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                />
              }
            />
          </View>
        </View>

        {/* Info & Policy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>
          <View style={styles.sectionContent}>
            <SettingItem
              icon="file-document"
              title="Privacy Policy"
              subtitle="Read our privacy policy"
              color={COLORS.primaryDark}
              onPress={() => navigation.navigate('LegalScreen', { type: 'privacy' })}
            />
            <SettingItem
              icon="scale-balance"
              title="Terms & Conditions"
              subtitle="Review terms and conditions"
              color={COLORS.warning}
              onPress={() => navigation.navigate('LegalScreen', { type: 'terms' })}
            />
          </View>
        </View>

        {/* Risk Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Risk Zone</Text>
          <View style={styles.sectionContent}>
            <TouchableOpacity
              style={styles.dangerItem}
              onPress={() => {
                Alert.alert(
                  'Delete Account',
                  'Are you sure you want to permanently delete your account? All your items, transactions, and settings will be permanently erased.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete Everything',
                      style: 'destructive',
                      onPress: async () => {
                        await StorageService.clearAllData();
                        await BiometricService.disableBiometric();
                        await StorageService.logout();
                        navigation.reset({
                          index: 0,
                          routes: [{ name: 'Login' } as any],
                        });
                      }
                    },
                  ],
                );
              }}>
              <View style={[styles.settingIcon, { backgroundColor: COLORS.danger + '15' }]}>
                <Icon name="account-remove" size={22} color={COLORS.danger} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: COLORS.danger }]}>
                  Delete Account
                </Text>
                <Text style={styles.settingSubtitle}>
                  Permanently delete all your data
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color={COLORS.border} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.infoText}>
          Keep your account secure by using a strong password and enabling two-factor authentication.
        </Text>
      </ScrollView>

      {/* Change Password Sheet */}
      <RBSheet
        ref={refRBSheet}
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
        <Text style={styles.sheetTitle}>Change Password</Text>

        <Text style={styles.inputLabel}>New Password</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, errors.new && styles.inputError]}
            secureTextEntry={!showNewPass}
            value={newPassword}
            onChangeText={(text: string) => {
              setNewPassword(text);
              if (errors.new) setErrors(prev => ({ ...prev, new: '' }));
            }}
            placeholder="At least 6 characters"
          />
          <TouchableOpacity onPress={() => setShowNewPass(!showNewPass)} style={styles.eyeIcon}>
            <Icon name={showNewPass ? 'eye-off' : 'eye'} size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
        {errors.new && <Text style={styles.errorText}>{errors.new}</Text>}

        <Text style={styles.inputLabel}>Confirm New Password</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, errors.confirm && styles.inputError]}
            secureTextEntry={!showConfirmPass}
            value={confirmNewPassword}
            onChangeText={(text: string) => {
              setConfirmNewPassword(text);
              if (errors.confirm) setErrors(prev => ({ ...prev, confirm: '' }));
            }}
            placeholder="Repeat new password"
          />
          <TouchableOpacity onPress={() => setShowConfirmPass(!showConfirmPass)} style={styles.eyeIcon}>
            <Icon name={showConfirmPass ? 'eye-off' : 'eye'} size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
        {errors.confirm && <Text style={styles.errorText}>{errors.confirm}</Text>}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSavePassword} disabled={loading}>
          <Text style={styles.saveBtnText}>{loading ? 'Updating...' : 'Update Password'}</Text>
        </TouchableOpacity>
      </RBSheet>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dangerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  settingSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  infoText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 32,
    marginTop: 12,
    lineHeight: 18,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    color: COLORS.textPrimary,
  },
  inputLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 10,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
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
  saveBtn: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    marginTop: 30,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
  },
});

export default PrivacySecurityScreen;
