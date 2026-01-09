// import React, { useState, useEffect } from 'react';
// import {
//     View,
//     Text,
//     StyleSheet,
//     TouchableOpacity,
//     Alert,
//     ActivityIndicator,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import Share from 'react-native-share';
// import * as DocumentPicker from '@react-native-documents/picker';
// import RNFS from 'react-native-fs';
// import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
// import { COLORS, SIZES, SHADOWS } from '../styles/theme';
// import Header from '../components/Header';
// import Card from '../components/Card';
// import StorageService from '../services/StorageService';

// const BackupScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
//     const [loading, setLoading] = useState(false);
//     const [username, setUsername] = useState('Vaishnavi');

//     useEffect(() => {
//         loadUser();
//     }, []);

//     const loadUser = async () => {
//         const user = await StorageService.getCurrentUser();
//         if (user && user.username) {
//             setUsername(user.username);
//         }
//     };

//     // Robust Base64 Utility for large UTF-8 strings
//     const toBase64 = (str: string) => {
//         try {
//             const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
//             let input = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
//                 return String.fromCharCode(parseInt(p1, 16));
//             });

//             let output = '';
//             let block, i = 0;

//             for (; i < input.length; i += 3) {
//                 const c1 = input.charCodeAt(i);
//                 const c2 = i + 1 < input.length ? input.charCodeAt(i + 1) : NaN;
//                 const c3 = i + 2 < input.length ? input.charCodeAt(i + 2) : NaN;

//                 block = (c1 << 16) | (isNaN(c2) ? 0 : c2 << 8) | (isNaN(c3) ? 0 : c3);

//                 output += b64.charAt((block >> 18) & 63);
//                 output += b64.charAt((block >> 12) & 63);
//                 output += isNaN(c2) ? '=' : b64.charAt((block >> 6) & 63);
//                 output += isNaN(c3) ? '=' : b64.charAt(block & 63);
//             }
//             return output;
//         } catch (e) {
//             console.error('Base64 Error:', e);
//             return '';
//         }
//     };

//     const handleExport = async () => {
//         try {
//             setLoading(true);
//             const data = await StorageService.backupData();

//             if (!data || data.length < 10) {
//                 throw new Error('No database data found.');
//             }

//             // Specific Filename requested: [Name]_backupSVJPOS.docx
//             const cleanUsername = username.replace(/[^a-zA-Z0-9]/g, '');
//             const fileName = `${cleanUsername}_backupSVJPOS.docx`;

//             const base64Data = toBase64(data);
//             if (!base64Data) {
//                 throw new Error('Encoding failed.');
//             }

//             const shareOptions = {
//                 title: 'Business Backup',
//                 url: `data:application/msword;base64,${base64Data}`,
//                 filename: fileName,
//                 type: 'application/msword',
//                 useInternalStorage: true,
//                 saveToFiles: true,
//             };

//             const result = await Share.open(shareOptions);
//             if (result.success) {
//                 Alert.alert('Backup Created', `Your file ${fileName} has been shared successfully.`);
//             }
//         } catch (error: any) {
//             if (error && error.message && error.message.includes('User cancelled')) return;
//             console.error('Export Error:', error);
//             Alert.alert('Export Failed', 'Unable to create backup file. Please check storage permissions.');
//         } finally {
//             setLoading(false);
//         }
//     };

//     const handleRestoreNow = async () => {
//         try {
//             // 1. Pick the file
//             const res = await DocumentPicker.pick({
//                 // The new library uses different type constants if needed, 
//                 // but usually stays compatible with basic pick options.
//             });

//             const file = res[0];

//             // 2. Strict Validation: Filename must contain 'backupSVJPOS'
//             if (!file.name?.toLocaleLowerCase().includes('backupsvjpos')) {
//                 Alert.alert('Invalid File', 'Please select a valid SVJPOS backup file (e.g., Vaishnavi_backupSVJPOS.docx).');
//                 return;
//             }

//             setLoading(true);

//             // 3. Read the file content
//             const filePath = file.uri;
//             const fileContent = await RNFS.readFile(filePath, 'utf8');

//             if (!fileContent || fileContent.length < 10) {
//                 throw new Error('Selected file is empty or corrupted.');
//             }

//             // 4. Extract and Validate JSON
//             let jsonData = fileContent.trim();
//             const startIdx = jsonData.indexOf('{');
//             const endIdx = jsonData.lastIndexOf('}');

//             if (startIdx === -1 || endIdx === -1) {
//                 throw new Error('This file does not contain valid SVJPOS business data.');
//             }

//             jsonData = jsonData.substring(startIdx, endIdx + 1);

//             const success = await StorageService.restoreData(jsonData);
//             if (success) {
//                 Alert.alert('Success', 'Restore successfully! Your app data has been recovered.', [
//                     { text: 'OK', onPress: () => navigation.navigate('HomeTab') }
//                 ]);
//             }
//         } catch (err: any) {
//             if (DocumentPicker.isCancel(err)) return;
//             console.error('Restore Error:', err);
//             Alert.alert('Restore Failed', err.message || 'Unable to read the selected file.');
//         } finally {
//             setLoading(false);
//         }
//     };

//     return (
//         <SafeAreaView style={styles.container} edges={['top']}>
//             <Header
//                 title="Backup & Restore"
//                 icon="cloud-sync"
//                 subtitle="Professional Data Management"
//                 onBack={() => navigation.goBack()}
//             />

//             <View style={styles.content}>
//                 <View style={styles.infoSection}>
//                     <View style={styles.iconCircle}>
//                         <Icon name="shield-lock" size={70} color={COLORS.primary} />
//                     </View>
//                     <Text style={styles.title}>Secure Business Cloud</Text>
//                     <Text style={styles.subtitle}>
//                         Your data is safe. Use the buttons below to create or recover your database.
//                     </Text>
//                 </View>

//                 <Card style={styles.card}>
//                     <TouchableOpacity
//                         style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
//                         onPress={handleExport}
//                         activeOpacity={0.8}
//                     >
//                         <View style={styles.btnIconBox}>
//                             <Icon name="file-upload" size={26} color="#fff" />
//                         </View>
//                         <View style={styles.btnTextBox}>
//                             <Text style={styles.btnTitle}>Share Backup</Text>
//                             <Text style={styles.btnInfo}>Save as {username}_backupSVJPOS.docx</Text>
//                         </View>
//                         <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.7)" />
//                     </TouchableOpacity>

//                     <View style={styles.divider} />

//                     <TouchableOpacity
//                         style={[styles.actionButton, { backgroundColor: COLORS.success }]}
//                         onPress={handleRestoreNow}
//                         activeOpacity={0.8}
//                     >
//                         <View style={styles.btnIconBox}>
//                             <Icon name="file-find" size={26} color="#fff" />
//                         </View>
//                         <View style={styles.btnTextBox}>
//                             <Text style={styles.btnTitle}>Restore Data Now</Text>
//                             <Text style={styles.btnInfo}>Select backup file from phone</Text>
//                         </View>
//                         <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.7)" />
//                     </TouchableOpacity>
//                 </Card>

//                 <View style={styles.footerInfo}>
//                     <Icon name="check-decagram-outline" size={16} color={COLORS.success} />
//                     <Text style={styles.footerLabel}>
//                         Verified Backup: Items, Orders, Expenses, and Store Details are fully protected.
//                     </Text>
//                 </View>
//             </View>

//             {loading && (
//                 <View style={styles.loadingDim}>
//                     <ActivityIndicator size="large" color={COLORS.primary} />
//                     <Text style={styles.loadingText}>Processing File...</Text>
//                 </View>
//             )}
//         </SafeAreaView>
//     );
// };

// const styles = StyleSheet.create({
//     container: {
//         flex: 1,
//         backgroundColor: COLORS.background,
//     },
//     content: {
//         flex: 1,
//         padding: SIZES.large,
//         justifyContent: 'center',
//     },
//     infoSection: {
//         alignItems: 'center',
//         marginBottom: 40,
//     },
//     iconCircle: {
//         width: 120,
//         height: 120,
//         borderRadius: 60,
//         backgroundColor: 'rgba(52, 152, 219, 0.1)',
//         alignItems: 'center',
//         justifyContent: 'center',
//         marginBottom: 20,
//     },
//     title: {
//         fontSize: 22,
//         fontWeight: 'bold',
//         color: COLORS.textPrimary,
//         marginBottom: 10,
//     },
//     subtitle: {
//         fontSize: 14,
//         color: COLORS.textSecondary,
//         textAlign: 'center',
//         paddingHorizontal: 20,
//         lineHeight: 20,
//     },
//     card: {
//         padding: 8,
//         borderRadius: 20,
//         ...SHADOWS.medium,
//     },
//     actionButton: {
//         flexDirection: 'row',
//         alignItems: 'center',
//         padding: 16,
//         borderRadius: 15,
//     },
//     btnIconBox: {
//         width: 44,
//         height: 44,
//         borderRadius: 10,
//         backgroundColor: 'rgba(255,255,255,0.25)',
//         alignItems: 'center',
//         justifyContent: 'center',
//         marginRight: 15,
//     },
//     btnTextBox: {
//         flex: 1,
//     },
//     btnTitle: {
//         fontSize: 16,
//         fontWeight: 'bold',
//         color: '#fff',
//     },
//     btnInfo: {
//         fontSize: 12,
//         color: 'rgba(255,255,255,0.85)',
//         marginTop: 2,
//     },
//     divider: {
//         height: 8,
//     },
//     footerInfo: {
//         flexDirection: 'row',
//         alignItems: 'flex-start',
//         marginTop: 30,
//         paddingHorizontal: 15,
//     },
//     footerLabel: {
//         fontSize: 12,
//         color: COLORS.textSecondary,
//         marginLeft: 8,
//         flex: 1,
//         lineHeight: 16,
//     },
//     loadingDim: {
//         ...StyleSheet.absoluteFillObject,
//         backgroundColor: 'rgba(255,255,255,0.7)',
//         alignItems: 'center',
//         justifyContent: 'center',
//         zIndex: 2000,
//     },
//     loadingText: {
//         marginTop: 10,
//         fontWeight: '600',
//         color: COLORS.primary,
//     },
// });

// export default BackupScreen;
