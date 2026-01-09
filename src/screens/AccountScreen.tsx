import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, SIZES, SHADOWS } from '../styles/theme';
import Header from '../components/Header';
import StorageService from '../services/StorageService';
import BiometricService from '../services/BiometricService';
import { Profile } from '../types';

import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RootStackParamList, RootTabParamList } from '../types';
import RBSheet from 'react-native-raw-bottom-sheet';


type AccountScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'AccountTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface RBSheetRef {
  open: () => void;
  close: () => void;
}

interface AccountScreenProps {
  navigation: AccountScreenNavigationProp;
}

const AccountScreen: React.FC<AccountScreenProps> = ({ navigation }) => {

  const [profile, setProfile] = useState<Profile>({ name: '', email: '' });
  // Track original email to identify user record during update
  const [originalEmail, setOriginalEmail] = useState('');

  const [notifications, setNotifications] = useState(true);
  const [loginEmail, setLoginEmail] = useState(profile.email);
  const [registerEmail, setRegisterEmail] = useState(profile.email);
  const [registerUsername, setRegisterUsername] = useState(profile.name);

  useEffect(() => {
    setLoginEmail(profile.email);
    setRegisterEmail(profile.email);
    setRegisterUsername(profile.name);
  }, [profile]);

  const loadProfile = async () => {
    // Priority 1: Get actual logged-in user
    const user = await StorageService.getCurrentUser();

    // Priority 2: Get generic profile (might be stale/disconnected)
    const data = await StorageService.getProfile();

    if (user) {
      setProfile({ name: user.username, email: user.email });
      setOriginalEmail(user.email);
    } else {
      setProfile(data);
      setOriginalEmail(data.email);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, []),
  );



  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await StorageService.logout();
              // Disable biometric login on logout
              await BiometricService.disableBiometric();
              navigation.navigate('Login');
            } catch (error) {
              console.error('Logout error:', error);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };


  const [tempProfile, setTempProfile] = useState<Profile>({ name: '', email: '' });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const refRBSheet = useRef<RBSheetRef>(null);



  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, []),
  );

  const handleSaveProfile = async () => {
    const newErrors: { [key: string]: string } = {};

    if (!tempProfile.name.trim()) {
      newErrors.name = 'Name is required';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!tempProfile.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(tempProfile.email.trim())) {
      newErrors.email = 'Invalid email format';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    // Save changes using unified updater
    const success = await StorageService.updateUserProfile(
      originalEmail,
      tempProfile.name,
      tempProfile.email
    );

    if (success) {
      setProfile(tempProfile);
      setOriginalEmail(tempProfile.email);
      refRBSheet.current?.close();
      Alert.alert('Success', 'Profile and Login credentials updated!');
    } else {
      Alert.alert('Error', 'Failed to update profile');
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
      disabled={!onPress}>
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="Account"
        icon="card-account-details"
        subtitle="User & Settings"
      />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.name ? profile.name.charAt(0).toUpperCase() : 'A'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile.name || 'Admin'}</Text>
            <Text style={styles.profileEmail}>{profile.email || 'admin@svjpos.com'}</Text>
          </View>
          <TouchableOpacity style={styles.editProfileBtn} onPress={() => {
            setTempProfile(profile);
            setErrors({});
            refRBSheet.current?.open();
          }}>
            <Icon name="pencil" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Business Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Settings</Text>
          <View style={styles.sectionContent}>
            <SettingItem
              icon="store"
              title="Store Details"
              subtitle="Manage address & contact info"
              color={COLORS.primary}
              onPress={() => navigation.navigate('StoreDetails' as any)}
            />
            <SettingItem
              icon="receipt"
              title="Tax Settings"
              subtitle="Manage tax rates"
              color={COLORS.accent}
              onPress={() => navigation.navigate('TaxMaster' as any)}
            />
            <SettingItem
              icon="printer"
              title="Printer Configuration"
              subtitle="Connect thermal printers"
              color={COLORS.warning}
              onPress={() => navigation.navigate('Printer')}
            />
            {/* <SettingItem
              icon="trash-can-outline"
              title="Clear All Data"
              subtitle="Reset application database"
              color={COLORS.danger}
              onPress={() => navigation.navigate('Expenses' as any)} // Placeholder if needed, but we'll add Backup below
            />

            <SettingItem
              icon="cloud-sync"
              title="Backup & Restore"
              subtitle="Export or import your data"
              color={COLORS.primary}
              onPress={() => navigation.navigate('Backup' as any)}
            /> */}
          </View>
        </View>

        {/* App Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Settings</Text>
          <View style={styles.sectionContent}>
            <SettingItem
              icon="bell"
              title="Notifications"
              color={COLORS.success}
              rightElement={
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                />
              }
            />
            {/* <SettingItem
              icon="shield-check"
              title="Privacy & Security"
              color={COLORS.textSecondary}
              onPress={() => navigation.navigate('PrivacySecurity' as any)}
            /> */}
            <SettingItem
              icon="help-circle"
              title="Help & Support"
              color={COLORS.primaryDark}
              onPress={() => { navigation.navigate("HelpScreen") }}
            // onPress={() => { }}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Icon name="logout" size={20} color={COLORS.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>SVJPOS v1.0.0</Text>
      </ScrollView>

      <RBSheet
        ref={refRBSheet}
        height={400}
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
        <Text style={styles.sheetTitle}>Edit Profile</Text>

        <Text style={styles.inputLabel}>Name</Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          value={tempProfile.name}
          onChangeText={text => {
            setTempProfile(prev => ({ ...prev, name: text }));
            if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
          }}
          maxLength={50}
        />
        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

        <Text style={styles.inputLabel}>Email</Text>
        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          value={tempProfile.email}
          onChangeText={text => {
            setTempProfile(prev => ({ ...prev, email: text }));
            if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
          }}
          keyboardType="email-address"
          maxLength={60}
          autoCapitalize="none"
        />
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
          <Text style={styles.saveBtnText}>Save</Text>
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: SIZES.radius,
    marginBottom: 24,
    ...SHADOWS.medium,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  profileEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  editProfileBtn: {
    padding: 8,
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
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: SIZES.radius,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.danger,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.danger,
  },
  versionText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 32,
  },

  // container: { flex: 1, backgroundColor: COLORS.background },
  // content: { flex: 1, padding: SIZES.large },
  // profileCard: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   backgroundColor: COLORS.surface,
  //   padding: 20,
  //   borderRadius: SIZES.radius,
  //   marginBottom: 24,
  //   ...SHADOWS.medium,
  // },
  // avatar: {
  //   width: 60,
  //   height: 60,
  //   borderRadius: 30,
  //   backgroundColor: COLORS.primary,
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   marginRight: 16,
  // },

  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20 },
  inputLabel: { fontSize: 14, color: COLORS.textSecondary, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 10,
    marginTop: 50,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
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

export default AccountScreen;
