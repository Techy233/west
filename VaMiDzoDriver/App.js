/**
 * VaMiDzo Driver App
 *
 * @format
 */

import React from 'react';
import AppNavigator from './src/navigation/AppNavigator'; // Import the navigator

function App() {
  // Basic structure, NavigationContainer will handle SafeArea and StatusBar for the most part
  return <AppNavigator />;
}

export default App;
