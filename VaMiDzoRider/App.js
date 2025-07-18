/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import {Colors} from 'react-native/Libraries/NewAppScreen';

// Placeholder for Navigation
import AppNavigator from './src/navigation/AppNavigator'; // Import the navigator
import { AuthProvider } from './src/contexts/AuthContext'; // Import AuthProvider

function App() {
  // const isDarkMode = useColorScheme() === 'dark'; // Not needed if AuthProvider wraps everything

  // const backgroundStyle = {
  //   backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  //   flex: 1,
  // };

  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: 'gray',
    marginBottom: 20,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 14,
    color: 'darkgray',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // sectionContainer: {
  //   marginTop: 32,
  //   paddingHorizontal: 24,
  // },
  // sectionTitle: {
  //   fontSize: 24,
  //   fontWeight: '600',
  // },
  // sectionDescription: {
  //   marginTop: 8,
  //   fontSize: 18,
  //   fontWeight: '400',
  // },
  // highlight: {
  //   fontWeight: '700',
  // },
});

export default App;
