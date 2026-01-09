import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../styles/theme';
import { RootStackParamList, RootTabParamList } from '../types';

// Screens
import HomeScreen from '../screens/HomeScreen';
import SalesScreen from '../screens/SalesScreen';
import ItemsScreen from '../screens/ItemsScreen';
import TaxMasterScreen from '../screens/TaxMasterScreen';
import OrdersScreen from '../screens/OrdersScreen';
import ReportsScreen from '../screens/ReportsScreen';
import AccountScreen from '../screens/AccountScreen';
import PrinterScreen from '../screens/PrinterScreen';
import CategoryMasterScreen from '../screens/CategoryMasterScreen';
import ItemFormScreen from '../screens/ItemFormScreen';
import LoginScreen from '../screens/LoginScreen';
import PrivacySecurityScreen from '../screens/PrivacySecurityScreen';
import StoreDetailsScreen from '../screens/StoreDetailsScreen';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const HomeStack: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Login">
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Home" component={HomeScreen} />
    <Stack.Screen name="Sales" component={SalesScreen} />
    <Stack.Screen name="Items" component={ItemsScreen} />
    <Stack.Screen name="TaxMaster" component={TaxMasterScreen} />
    <Stack.Screen name="Printer" component={PrinterScreen} />
    <Stack.Screen name="ItemForm" component={ItemFormScreen} />
    <Stack.Screen name="CategoryMaster" component={CategoryMasterScreen} />
    <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
    <Stack.Screen name="StoreDetails" component={StoreDetailsScreen} />
  </Stack.Navigator>
);

const AppNavigator: React.FC = () => {

  console.log("Home Screeen")
  console.log("AppNavigator");
  const insets = useSafeAreaInsets();


  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          if (route.name === 'HomeTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'OrdersTab') {
            iconName = focused ? 'clipboard-text' : 'clipboard-text-outline';
          } else if (route.name === 'ReportsTab') {
            iconName = focused ? 'chart-bar' : 'chart-bar';
          } else if (route.name === 'AccountTab') {
            iconName = focused ? 'account' : 'account-outline';
          } else {
            iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        headerShown: false,
        tabBarStyle: {
          // paddingBottom: 5,
          height: 60,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 6,
        },
      })}>
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="OrdersTab"
        component={OrdersScreen}
        options={{ tabBarLabel: 'Orders' }}
      />
      <Tab.Screen
        name="ReportsTab"
        component={ReportsScreen}
        options={{ tabBarLabel: 'Reports' }}
      />
      <Tab.Screen
        name="AccountTab"
        component={AccountScreen}
        options={{ tabBarLabel: 'Account' }}
      />
    </Tab.Navigator>
  );
};

export default AppNavigator;
