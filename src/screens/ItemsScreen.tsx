import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, SIZES, SHADOWS } from '../styles/theme';
import Header from '../components/Header';
import StorageService from '../services/StorageService';
import { formatCurrency } from '../utils/helpers';
import { Item, RootStackParamList, Category } from '../types';
import { Swipeable } from 'react-native-gesture-handler';


type ItemsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Items'>;

interface ItemsScreenProps {
  navigation: ItemsScreenNavigationProp;
}

const ItemsScreen: React.FC<ItemsScreenProps> = ({ navigation }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [fetchedItems, fetchedCategories] = await Promise.all([
      StorageService.getItems(),
      StorageService.getCategories(),
    ]);
    setItems(fetchedItems);
    setCategories(fetchedCategories);
    applyFilters(fetchedItems, searchQuery, selectedCategoryId);
    setLoading(false);
  };

  const getCategoryCount = (catId: string | null) => {
    if (!catId) return items.length;
    return items.filter(i => i.categoryId === catId).length;
  };

  const applyFilters = (data: Item[], query: string, catId: string | null) => {
    let filtered = data;

    // Filter by Category
    if (catId) {
      filtered = filtered.filter(item => item.categoryId === catId);
    }

    // Filter by Search
    if (query) {
      filtered = filtered.filter(
        item =>
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          item.code.toLowerCase().includes(query.toLowerCase()),
      );
    }

    setFilteredItems(filtered);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    applyFilters(items, text, selectedCategoryId);
  };

  const handleAddItem = () => {
    if (items.length >= 10) {
      Alert.alert('Limit Reached', 'Only 10 items allowed');
      return;
    }
    navigation.navigate('ItemForm', {});
  };

  const handleCategorySelect = (catId: string | null) => {
    setSelectedCategoryId(catId);
    applyFilters(items, searchQuery, catId);
  };

  const getCategoryName = (catId?: string) => {
    if (!catId) return '';
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.name : '';
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedItems = filteredItems.filter(item => item.id !== id);
            setFilteredItems(updatedItems);
            await StorageService.deleteItem(id);
          },
        },
      ]
    );
  };



  const renderItem = ({ item }: { item: Item }) => {
    const categoryName = getCategoryName(item.categoryId);

    const renderRightActions = () => (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item.id)}
      >
        <Icon name="delete" size={24} color="#fff" />
      </TouchableOpacity>
    );

    return (
      <Swipeable
        renderRightActions={renderRightActions}
        overshootRight={false}
      >
        <Pressable style={styles.itemCard} onPress={() => navigation.navigate('ItemForm', { item })}>
          <View style={[styles.itemIcon, { backgroundColor: COLORS.primary + '10' }]}>
            <Icon name="package-variant" size={24} color={COLORS.primary} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={2} >{item.name}</Text>
            <View style={styles.codeRow}>
              <Text style={styles.itemCode}>{item.code}</Text>
            </View>

            <View style={styles.badgesRow}>
              {!!categoryName && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{categoryName}</Text>
                </View>
              )}
              {(item.stock !== undefined && item.stock < 5) && (
                <View style={styles.lowStockBadge}>
                  <Text style={styles.lowStockText}>Low Stock: {item.stock}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.itemPriceAction}>
            <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
          </View>
        </Pressable>
      </Swipeable>
    );
  };


  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header
        title="Items"
        icon="package-variant"
        subtitle="Manage Inventory"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        rightComponent={
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => navigation.navigate('CategoryMaster')} style={styles.addButtonHeader}>
              <Icon name="shape" size={26} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAddItem} style={styles.addButtonHeader}>
              <Icon name="plus" size={30} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        }
      />

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon name="magnify" size={20} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Icon name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {categories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryFilterList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedCategoryId === null && styles.filterChipSelected
              ]}
              onPress={() => handleCategorySelect(null)}
            >
              <Text style={[
                styles.filterChipText,
                selectedCategoryId === null && styles.filterChipTextSelected
              ]}>
                All ({items.length})
              </Text>
            </TouchableOpacity>

            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.filterChip,
                  selectedCategoryId === cat.id && styles.filterChipSelected
                ]}
                onPress={() => handleCategorySelect(cat.id)}
              >
                <Text style={[
                  styles.filterChipText,
                  selectedCategoryId === cat.id && styles.filterChipTextSelected
                ]}>
                  {cat.name} ({getCategoryCount(cat.id)})
                </Text>
              </TouchableOpacity>
            ))}

          </ScrollView>
        )}
      </View>

      {categories.length === 0 && (
        <View style={styles.countRow}>
          <Text style={styles.countText}>
            Total Items: {filteredItems.length}
          </Text>
        </View>
      )}



      <FlatList
        data={[...filteredItems].reverse()}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadData} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="package-variant" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No items match your search' : 'No items found'}
            </Text>
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
  searchContainer: {
    padding: SIZES.medium,
    backgroundColor: COLORS.surface,
    paddingBottom: 0,
    marginBottom: SIZES.medium,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.medium,
    height: 48,
    marginBottom: SIZES.medium,
  },
  searchInput: {
    flex: 1,
    marginLeft: SIZES.small,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  categoryFilterList: {
    gap: 10,
    paddingBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  filterChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  countRow: {
    marginBottom: 8,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginLeft: SIZES.medium,
    marginBottom: 6
  },

  listContent: {
    padding: SIZES.medium,
    paddingTop: 0,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    padding: SIZES.medium,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // codeRow: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   marginBottom: 4,
  // },

  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },

  itemCode: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  categoryBadge: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.primary,

  },
  lowStockBadge: {
    backgroundColor: COLORS.danger + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 6
  },
  lowStockText: {
    color: COLORS.danger,
    fontSize: 10,
    fontWeight: '600',
  },
  itemPriceAction: {
    alignItems: 'flex-end',
    gap: 8,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  editButton: {
    padding: 4,
  },
  addButtonHeader: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },

  //   itemCard: {
  //   backgroundColor: COLORS.surface,
  //   padding: 16,
  //   borderRadius: 8,
  //   borderWidth: 1,
  //   borderColor: COLORS.border,
  //   marginBottom: 8,
  // },

  deleteButton: {
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    marginVertical: 8,
    borderRadius: 8,
  },

});

export default ItemsScreen;
