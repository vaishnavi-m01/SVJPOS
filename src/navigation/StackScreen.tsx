import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types";
import HomeScreen from "../screens/HomeScreen";
import SalesScreen from "../screens/SalesScreen";
import ItemsScreen from "../screens/ItemsScreen";
import TaxMasterScreen from "../screens/TaxMasterScreen";
import PrinterScreen from "../screens/PrinterScreen";
import ItemFormScreen from "../screens/ItemFormScreen";
import Tabs from "./Tabs";
import CategoryMasterScreen from "../screens/CategoryMasterScreen";
import TaxFormScreen from "../screens/TaxFormScreen";
import LoginScreen from "../screens/LoginScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import HelpScreen from "../screens/HelpScreen";
import PrivacySecurityScreen from "../screens/PrivacySecurityScreen";
import StoreDetailsScreen from "../screens/StoreDetailsScreen";
import LegalScreen from "../screens/LegalScreen";
import ExpensesScreen from "../screens/ExpensesScreen";

const StackScreen = () => {
    const Stack = createNativeStackNavigator<RootStackParamList>();
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Login">
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Tabs" component={Tabs} />
            {/* <Stack.Screen name="Home" component={HomeScreen} /> */}
            <Stack.Screen name="Sales" component={SalesScreen} />
            <Stack.Screen name="Items" component={ItemsScreen} />
            <Stack.Screen name="TaxMaster" component={TaxMasterScreen} />
            <Stack.Screen name="Printer" component={PrinterScreen} />
            <Stack.Screen name="ItemForm" component={ItemFormScreen} />
            <Stack.Screen name="CategoryMaster" component={CategoryMasterScreen} />
            <Stack.Screen name="TaxForm" component={TaxFormScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="HelpScreen" component={HelpScreen} />
            <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
            <Stack.Screen name="StoreDetails" component={StoreDetailsScreen} />
            <Stack.Screen name="LegalScreen" component={LegalScreen} />
            <Stack.Screen name="Expenses" component={ExpensesScreen} />

        </Stack.Navigator>
    )
}

export default StackScreen;