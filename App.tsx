import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import StackScreen from './src/navigation/StackScreen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const App = () => {

  console.log("App")
  console.log(require('react-native-camera-kit'));


  return (
    <GestureHandlerRootView style={{ flex: 1 }}>

      <SafeAreaProvider style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFB" translucent={false} />
        <NavigationContainer>
          <StackScreen />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;

