import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { RootTabParamList } from "../types";
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from "../constants/colors";
import { useSafeAreaFrame, useSafeAreaInsets } from "react-native-safe-area-context";
import HomeScreen from "../screens/HomeScreen";
import OrdersScreen from "../screens/OrdersScreen";
import ReportsScreen from "../screens/ReportsScreen";
import AccountScreen from "../screens/AccountScreen";


const Tabs = () => {
    const Tab = createBottomTabNavigator<RootTabParamList>();
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
                    height: 60 + (insets.bottom > 0 ? insets.bottom : 10),
                    paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
                    paddingTop: 5,
                },
                tabBarIconStyle: {
                    marginTop: 6,
                },
            })}>
            <Tab.Screen
                name="HomeTab"
                component={HomeScreen}
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
    )
}

export default Tabs;