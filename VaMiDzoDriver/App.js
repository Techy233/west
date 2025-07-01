/**
 * VaMiDzo Driver App
 *
 * @format
 */

import React from 'react';
import AppNavigator from './src/navigation/AppNavigator'; // Import the navigator

import { AuthProvider } from './src/contexts/AuthContext'; // Import AuthProvider for Driver

function App() {
  // Basic structure, NavigationContainer will handle SafeArea and StatusBar for the most part
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}

export default App;
