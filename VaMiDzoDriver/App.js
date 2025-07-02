/**
 * VaMiDzo Driver App
 *
 * @format
 */

import React, { useEffect } from 'react'; // Added useEffect
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/contexts/AuthContext';
import {
    onTokenRefreshListener,
    onForegroundMessageListener,
    onNotificationOpenedAppListener,
    getInitialNotification
} from './src/services/notificationService'; // For Driver app
import { useNavigationContainerRef } from '@react-navigation/native';

function App() {
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    const unsubscribeForeground = onForegroundMessageListener();
    const unsubscribeOpenedApp = onNotificationOpenedAppListener(navigationRef);
    getInitialNotification(navigationRef);
    const unsubscribeTokenRefresh = onTokenRefreshListener();

    return () => {
      unsubscribeForeground();
      unsubscribeOpenedApp();
      unsubscribeTokenRefresh();
    };
  }, []);

  return (
    <AuthProvider>
      <AppNavigator navigationRef={navigationRef} /> {/* Pass ref */}
    </AuthProvider>
  );
}

export default App;
