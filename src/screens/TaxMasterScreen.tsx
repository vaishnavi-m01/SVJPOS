import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, SIZES, SHADOWS } from '../styles/theme';
import Header from '../components/Header';
import { RootStackParamList, Tax } from '../types';
import { useFocusEffect } from '@react-navigation/core';
import StorageService from '../services/StorageService';

type TaxMasterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'TaxMaster'>;

interface TaxMasterScreenProps {
  navigation: TaxMasterScreenNavigationProp;
}

const TaxMasterScreen: React.FC<TaxMasterScreenProps> = ({ navigation }) => {
  // const [taxes, setTaxes] = useState<Tax[]>([
  //   { id: '1', name: 'VAT', rate: 5, description: 'Value Added Tax', isDefault: true },
  //   { id: '2', name: 'Service Charge', rate: 10, description: 'Dine-in service charge', isDefault: false },
  // ]);

  const [taxes, setTaxes] = useState<Tax[]>([]);
  console.log("Rendered TaxMasterScreen with taxes:",taxes);

  useFocusEffect(
    useCallback(() => {
      loadTaxes();
    }, [])
  );

  const loadTaxes = async () => {
    const storedTaxes = await StorageService.getTaxes();
    setTaxes(storedTaxes);
  };

  const handleAddTax = () => {
    navigation.navigate('TaxForm', {});
  };

  const handleEditTax = (tax: Tax) => {
    navigation.navigate('TaxForm', { tax });
  };

  const handleDeleteTax = async (id: string) => {
    Alert.alert(
      'Delete Tax',
      'Are you sure you want to delete this tax?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await StorageService.deleteTax(id);
            loadTaxes();
          },
        },
      ]
    );
  };


  const renderTaxItem = ({ item }: { item: Tax }) => (
    <View style={styles.taxCard}>
      <TouchableOpacity style={styles.taxInfo} onPress={() => handleEditTax(item)}>
        <View style={styles.taxHeader}>
          <Text style={styles.taxName}>{item.name}</Text>
          {item.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultText}>Default</Text>
            </View>
          )}
        </View>
        <Text style={styles.taxDesc}>{item.description}</Text>
      </TouchableOpacity>

      <View style={styles.rightsection}>
        <View style={styles.taxRateContainer}>
          <Text style={styles.taxRate}>{item.rate}%</Text>

        </View>

        {/* Delete Button */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteTax(item.id)}
        >
          <Icon name="delete-outline" size={22} color="red" />
        </TouchableOpacity>
      </View>
    </View>
  );


  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header
        title="Tax Master"
        icon="receipt"
        subtitle="Manage Tax Rates"
        onBack={() => navigation.goBack()}
        rightComponent={
          <TouchableOpacity onPress={handleAddTax} style={styles.addButton}>
            <Icon name="plus" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        }
      />
      <View style={styles.content}>
        <FlatList
          data={taxes}
          renderItem={renderTaxItem}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            taxes.length === 0 && { flex: 1, justifyContent: 'center', alignItems: 'center' },
          ]}
          ListHeaderComponent={
            taxes.length > 0 ? (
              <Text style={styles.sectionTitle}>Active Tax Rates</Text>
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No tax available</Text>
          }
        />
      </View>

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
    paddingHorizontal: SIZES.base * 2
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContent: {
    gap: 12,
    paddingBottom: 33
  },
  taxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },

  taxInfo: {
    flex: 1,
  },
  taxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  taxName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  defaultBadge: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  taxDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  rightsection: {
    flexDirection: "row",
    alignItems: "center"
  },
  taxRateContainer: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  taxRate: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  deleteButton: {
    marginLeft: 8,
    padding: 4,
  },

  addButton: {
    padding: 4,
  }
});

export default TaxMasterScreen;
