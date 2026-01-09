import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SectionList,
    TouchableOpacity,
    Platform,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES, SHADOWS } from '../styles/theme';
import Header from '../components/Header';
import { RootStackParamList, Notification } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

const { width } = Dimensions.get('window');

type NotificationsScreenProps = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Notifications'>;
};

interface NotificationSection {
    title: string;
    data: Notification[];
}

const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ navigation }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const loadNotifications = async () => {
        try {
            const saved = await AsyncStorage.getItem('@notifications');
            if (saved) {
                setNotifications(JSON.parse(saved));
            }
        } catch (e) {
            console.error(e);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadNotifications();
        }, [])
    );

    const markAsRead = async (id: string) => {
        setNotifications(prev => {
            if (!prev.find(n => n.id === id && !n.read)) return prev;

            const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
            // Non-blocking save to AsyncStorage
            AsyncStorage.setItem('@notifications', JSON.stringify(updated)).catch(e => console.error(e));
            return updated;
        });
    };

    const clearAll = async () => {
        setNotifications([]);
        await AsyncStorage.removeItem('@notifications');
    };

    const sections = useMemo(() => {
        const today: Notification[] = [];
        const yesterday: Notification[] = [];
        const earlier: Notification[] = [];

        const now = new Date();
        const todayDate = now.toDateString();
        const yesterdayDate = new Date(now.setDate(now.getDate() - 1)).toDateString();

        notifications.forEach(n => {
            // In a real app, 'time' would be a timestamp. 
            // For this demo, we'll categorize based on the 'time' string if it contains "Today"/"Yesterday"
            // or try to parse id as timestamp if it's numeric
            const nDate = new Date(parseInt(n.id)).toDateString();

            if (nDate === todayDate || n.time.includes('Today') || n.time.includes('mins ago')) {
                today.push(n);
            } else if (nDate === yesterdayDate || n.time.includes('Yesterday')) {
                yesterday.push(n);
            } else {
                earlier.push(n);
            }
        });

        const result: NotificationSection[] = [];
        if (today.length > 0) result.push({ title: 'Today', data: today });
        if (yesterday.length > 0) result.push({ title: 'Yesterday', data: yesterday });
        if (earlier.length > 0) result.push({ title: 'Earlier', data: earlier });

        return result;
    }, [notifications]);

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'error': return COLORS.danger;
            case 'warning': return COLORS.warning;
            case 'success': return COLORS.success;
            default: return COLORS.primary;
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'printer': return 'printer-pos';
            case 'stock': return 'package-variant-closed-alert';
            case 'sales': return 'trending-up';
            default: return 'bell-outline';
        }
    };

    const renderItem = ({ item }: { item: Notification }) => (
        <TouchableOpacity
            activeOpacity={0.7}
            style={[
                styles.notificationCard,
                !item.read && styles.unreadCard
            ]}
            onPress={() => markAsRead(item.id)}
        >
            <View style={[styles.iconContainer, { backgroundColor: getSeverityColor(item.severity) + '15' }]}>
                <Icon name={getIcon(item.type)} size={24} color={getSeverityColor(item.severity)} />
            </View>

            <View style={styles.textContainer}>
                <View style={styles.headerRow}>
                    <Text style={[styles.title, !item.read && styles.unreadTitle]}>{item.title}</Text>
                    <Text style={styles.time}>{item.time}</Text>
                </View>
                <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
            </View>

            {!item.read && <View style={styles.unreadIndicator} />}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Header
                title="Notifications"
                icon="bell-ring"
                onBack={() => navigation.goBack()}
                rightComponent={
                    notifications.length > 0 ? (
                        <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
                            <Text style={styles.clearBtnText}>Clear All</Text>
                        </TouchableOpacity>
                    ) : null
                }
            />

            <View style={styles.content}>
                <SectionList
                    sections={sections}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    renderSectionHeader={({ section: { title } }) => (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>{title}</Text>
                            <View style={styles.sectionDivider} />
                        </View>
                    )}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    stickySectionHeadersEnabled={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconBg}>
                                <Icon name="bell-sleep" size={80} color={COLORS.primary + '20'} />
                            </View>
                            <Text style={styles.emptyTitle}>All caught up!</Text>
                            <Text style={styles.emptySubtitle}>
                                No new notifications at the moment. We'll alert you here when something important happens.
                            </Text>
                        </View>
                    }
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    content: {
        flex: 1,
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 12,
        gap: 12,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.textSecondary,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    sectionDivider: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.border,
        opacity: 0.5,
    },
    notificationCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        alignItems: 'center',
        ...SHADOWS.small,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    unreadCard: {
        backgroundColor: '#fff',
        borderColor: COLORS.primary + '15',
        ...SHADOWS.medium,
    },
    iconContainer: {
        width: 52,
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
        // Glassmorphism effect
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
    },
    textContainer: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.textPrimary,
        flex: 1,
        paddingRight: 8,
    },
    unreadTitle: {
        fontWeight: '700',
        color: '#000',
    },
    time: {
        fontSize: 11,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    message: {
        fontSize: 13,
        color: COLORS.textSecondary,
        lineHeight: 18,
    },
    unreadIndicator: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.primary,
        marginLeft: 12,
        borderWidth: 2,
        borderColor: '#fff',
    },
    clearBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: COLORS.primary + '10',
        borderRadius: 10,
    },
    clearBtnText: {
        color: COLORS.primary,
        fontWeight: '700',
        fontSize: 13,
    },
    emptyContainer: {
        paddingTop: 100,
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyIconBg: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        ...SHADOWS.medium,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: 12,
    },
    emptySubtitle: {
        fontSize: 15,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
});

export default NotificationsScreen;
