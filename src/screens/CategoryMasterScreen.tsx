import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Alert,
    TextInput,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, SIZES, SHADOWS } from '../styles/theme';
import Header from '../components/Header';
import { RootStackParamList, Category } from '../types';
import StorageService from '../services/StorageService';

type CategoryMasterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CategoryMaster'>;

interface CategoryMasterScreenProps {
    navigation: CategoryMasterScreenNavigationProp;
}

const CategoryMasterScreen: React.FC<CategoryMasterScreenProps> = ({ navigation }) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const loadCategories = async () => {
        setLoading(true);
        const data = await StorageService.getCategories();
        setCategories(data);
        setLoading(false);
    };

    useFocusEffect(
        useCallback(() => {
            loadCategories();
        }, []),
    );

    const handleSaveCategory = async () => {
        if (!newCategoryName.trim()) {
            Alert.alert('Error', 'Category name cannot be empty');
            return;
        }

        try {
            if (editingId) {
                await StorageService.updateCategory(editingId, { name: newCategoryName });
            } else {
                await StorageService.addCategory({ name: newCategoryName });
            }
            setNewCategoryName('');
            setIsAdding(false);
            setEditingId(null);
            loadCategories();
        } catch (error) {
            Alert.alert('Error', 'Failed to save category');
        }
    };

    const handleEdit = (category: Category) => {
        setNewCategoryName(category.name);
        setEditingId(category.id);
        setIsAdding(true);
    };

    const handleDelete = (id: string) => {
        Alert.alert('Delete Category', 'Are you sure you want to delete this category?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await StorageService.deleteCategory(id);
                    loadCategories();
                },
            },
        ]);
    };

    const renderItem = ({ item }: { item: Category }) => (
        <View style={styles.card}>
            <View style={styles.cardIcon}>
                <Icon name="shape-outline" size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <View style={styles.actions}>
                <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionBtn}>
                    <Icon name="pencil" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
                    <Icon name="delete" size={20} color={COLORS.danger} />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <Header
                title="Categories"
                // icon="shape"
                subtitle="Manage Product Categories"
                onBack={() => navigation.goBack()}
                rightComponent={
                    <TouchableOpacity onPress={() => {
                        setIsAdding(true);
                        setNewCategoryName('');
                        setEditingId(null);
                    }}>
                        <Icon name="plus" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                }
            />

            {isAdding && (
                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>{editingId ? 'Edit Category' : 'New Category'}</Text>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.input}
                            value={newCategoryName}
                            onChangeText={setNewCategoryName}
                            placeholder="Enter category name"
                            autoFocus
                            maxLength={25}
                        />
                        <TouchableOpacity onPress={handleSaveCategory} style={styles.saveBtn}>
                            <Icon name="check" size={24} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            setIsAdding(false);
                            setNewCategoryName('');
                            setEditingId(null);
                        }} style={styles.cancelBtn}>
                            <Icon name="close" size={24} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <FlatList
                data={[...categories].reverse()}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={loadCategories} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="shape-outline" size={48} color={COLORS.textSecondary} />
                        <Text style={styles.emptyText}>No categories found</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    listContent: {
        padding: SIZES.medium,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        padding: 16,
        borderRadius: SIZES.radius,
        marginBottom: 12,
        ...SHADOWS.small,
    },
    cardIcon: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: COLORS.primary + '15',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    cardTitle: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionBtn: {
        padding: 4,
    },
    inputContainer: {
        padding: 16,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        ...SHADOWS.small,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textSecondary,
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    input: {
        flex: 1,
        height: 44,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 16,
        color: COLORS.textPrimary,
        backgroundColor: COLORS.background,
    },
    saveBtn: {
        width: 44,
        height: 44,
        backgroundColor: COLORS.success,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtn: {
        width: 44,
        height: 44,
        backgroundColor: COLORS.background,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 48,
    },
    emptyText: {
        marginTop: 12,
        color: COLORS.textSecondary,
        fontSize: 16,
    },
});

export default CategoryMasterScreen;
