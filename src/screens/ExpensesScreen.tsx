import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    Modal,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, SIZES, SHADOWS } from '../styles/theme';
import Header from '../components/Header';
import Card from '../components/Card';
import StorageService from '../services/StorageService';
import { Expense } from '../types';
import { formatCurrency } from '../utils/helpers';

const ExpensesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('General');
    const [loading, setLoading] = useState(false);

    const loadExpenses = async () => {
        const data = await StorageService.getExpenses();
        setExpenses(data);
    };

    useFocusEffect(
        useCallback(() => {
            loadExpenses();
        }, [])
    );

    const handleAddExpense = async () => {
        if (!description.trim() || !amount.trim()) {
            Alert.alert('Error', 'Please fill all fields');
            return;
        }

        setLoading(true);
        const newExpense = {
            description,
            amount: parseFloat(amount),
            category,
            date: new Date().toISOString(),
        };

        const success = await StorageService.addExpense(newExpense);
        if (success) {
            setDescription('');
            setAmount('');
            setCategory('General');
            setModalVisible(false);
            loadExpenses();
        } else {
            Alert.alert('Error', 'Failed to save expense');
        }
        setLoading(false);
    };

    const handleDeleteExpense = (id: string) => {
        Alert.alert(
            'Delete Expense',
            'Are you sure you want to delete this expense?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await StorageService.deleteExpense(id);
                        loadExpenses();
                    },
                },
            ]
        );
    };

    const renderExpenseItem = ({ item }: { item: Expense }) => (
        <Card style={styles.expenseCard}>
            <View style={styles.expenseInfo}>
                <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{item.category}</Text>
                </View>
                <Text style={styles.description}>{item.description}</Text>
                <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
            </View>
            <View style={styles.expenseAmount}>
                <Text style={styles.amountText}>{formatCurrency(item.amount)}</Text>
                <TouchableOpacity onPress={() => handleDeleteExpense(item.id)} style={styles.deleteBtn}>
                    <Icon name="delete-outline" size={20} color={COLORS.danger} />
                </TouchableOpacity>
            </View>
        </Card>
    );

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Header
                title="Expenses"
                icon="cash-minus"
                subtitle="Manage daily shop expenses"
                onBack={() => navigation.goBack()}
            />

            <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total Expenses</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalExpenses)}</Text>
            </View>

            <FlatList
                data={expenses}
                renderItem={renderExpenseItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="cash-off" size={64} color={COLORS.border} />
                        <Text style={styles.emptyText}>No expenses recorded yet</Text>
                    </View>
                }
            />

            <TouchableOpacity
                style={styles.fab}
                onPress={() => setModalVisible(true)}
            >
                <Icon name="plus" size={30} color="#fff" />
            </TouchableOpacity>

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Add Expense</Text>

                        <Text style={styles.inputLabel}>Description</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Shop Rent, EB Bill, Tea"
                            value={description}
                            onChangeText={setDescription}
                        />

                        <Text style={styles.inputLabel}>Amount</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="0.00"
                            keyboardType="numeric"
                            value={amount}
                            onChangeText={setAmount}
                        />

                        <Text style={styles.inputLabel}>Category</Text>
                        <View style={styles.categoryContainer}>
                            {['General', 'Rent', 'Bills', 'Salary', 'Misc'].map((cat) => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[
                                        styles.categoryChip,
                                        category === cat && styles.categoryChipSelected,
                                    ]}
                                    onPress={() => setCategory(cat)}
                                >
                                    <Text style={[
                                        styles.categoryChipText,
                                        category === cat && styles.categoryChipTextSelected
                                    ]}>{cat}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveBtn, loading && { opacity: 0.7 }]}
                                onPress={handleAddExpense}
                                disabled={loading}
                            >
                                <Text style={styles.saveBtnText}>{loading ? 'Saving...' : 'Add Expense'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    listContent: {
        padding: SIZES.large,
        paddingBottom: 100,
    },
    summaryCard: {
        backgroundColor: COLORS.primary,
        margin: SIZES.large,
        padding: 20,
        borderRadius: SIZES.radius,
        ...SHADOWS.medium,
        alignItems: 'center',
    },
    summaryLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        marginBottom: 4,
    },
    summaryValue: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '700',
    },
    expenseCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        marginBottom: 12,
        alignItems: 'center',
    },
    expenseInfo: {
        flex: 1,
    },
    categoryBadge: {
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginBottom: 6,
    },
    categoryText: {
        fontSize: 10,
        color: COLORS.textSecondary,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    description: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    date: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    expenseAmount: {
        alignItems: 'flex-end',
        gap: 10,
    },
    amountText: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.danger,
    },
    deleteBtn: {
        padding: 4,
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        backgroundColor: COLORS.primary,
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.medium,
        elevation: 5,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
    },
    emptyText: {
        marginTop: 16,
        color: COLORS.textSecondary,
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: 8,
        marginTop: 12,
    },
    input: {
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    categoryContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    categoryChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    categoryChipSelected: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    categoryChipText: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    categoryChipTextSelected: {
        color: '#fff',
        fontWeight: '600',
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 32,
    },
    cancelBtn: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cancelBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    saveBtn: {
        flex: 2,
        backgroundColor: COLORS.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    saveBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});

export default ExpensesScreen;
