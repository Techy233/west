// VaMiDzoDriver/src/services/notificationService.js
import messaging from '@react-native-firebase/messaging';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './api'; // To send token to backend

// Function to request notification permission
export async function requestNotificationPermission() {
  if (Platform.OS === 'ios') {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('Driver Notification Authorization status:', authStatus);
      return true;
    } else {
      console.log('Driver Notification Authorization status: Denied or Not Determined');
      return false;
    }
  } else { // Android
    console.log('Assuming Android notification permission is granted or handled by OS/RNFirebase for Driver app.');
    return true;
  }
}

// Get FCM token and send to backend
export async function getAndSendDeviceToken(driverId) { // driverId is userId for driver
  if (!driverId) {
    console.warn("Driver: Cannot send device token without driverId.");
    return;
  }
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission && Platform.OS === 'ios') {
        console.log("Driver: No notification permission, cannot get or send token.");
        return;
    }

    const fcmToken = await messaging().getToken();
    if (fcmToken) {
      console.log('Driver FCM Token:', fcmToken);
      const storedToken = await AsyncStorage.getItem('fcmDeviceToken_driver');

      if (fcmToken !== storedToken) {
        await apiClient.post('/users/me/device-token', { // Same endpoint, backend uses authenticated user's ID
          device_token: fcmToken,
          device_type: Platform.OS,
        });
        await AsyncStorage.setItem('fcmDeviceToken_driver', fcmToken);
        console.log('Driver FCM token sent to server and stored locally.');
      } else {
        console.log('Driver FCM token is current, no need to resend.');
      }
    } else {
      console.log('Failed to get FCM token for driver.');
    }
  } catch (error) {
    console.error('Error getting/sending FCM token for driver:', error.response?.data || error.message);
  }
}

// Listener for when a new token is generated
export function onTokenRefreshListener() {
    return messaging().onTokenRefresh(async (newFcmToken) => {
        console.log('Driver FCM Token refreshed:', newFcmToken);
        const driverDataString = await AsyncStorage.getItem('driverUserData'); // Key from Driver's AuthContext
        if (driverDataString) {
            const driverData = JSON.parse(driverDataString);
            if (driverData && driverData.userId) { // userId is the driverId
                 try {
                    await apiClient.post('/users/me/device-token', {
                        device_token: newFcmToken,
                        device_type: Platform.OS,
                    });
                    await AsyncStorage.setItem('fcmDeviceToken_driver', newFcmToken);
                    console.log('Refreshed Driver FCM token sent to server.');
                } catch (error) {
                    console.error('Error sending refreshed FCM token for driver:', error);
                }
            } else {
                 await AsyncStorage.setItem('pendingFcmDeviceToken_driver', newFcmToken);
                 console.log('Driver not logged in. Storing refreshed token to send upon login.');
            }
        } else {
             await AsyncStorage.setItem('pendingFcmDeviceToken_driver', newFcmToken);
             console.log('Driver not logged in. Storing refreshed token to send upon login.');
        }
    });
}

// Handle foreground messages
export function onForegroundMessageListener() {
  return messaging().onMessage(async remoteMessage => {
    console.log('Driver: A new FCM message arrived in foreground!', JSON.stringify(remoteMessage));
    Alert.alert(
      remoteMessage.notification?.title || 'New Ride Alert!',
      remoteMessage.notification?.body || 'You have a new ride request or update.',
      [{ text: 'OK'}]
    );
    // Data payload: remoteMessage.data (e.g., { rideId: '...', type: 'NEW_RIDE_REQUEST' })
    // TODO: Could use this data to update UI, e.g., show ride request if not already shown via WebSocket
  });
}

// Handle background/quit state messages (user taps on notification)
export function onNotificationOpenedAppListener(navigation) { // Pass navigation ref
  return messaging().onNotificationOpenedApp(remoteMessage => {
    console.log('Driver: Notification caused app to open from background state:', remoteMessage);
    if (remoteMessage) {
        // Example: if (remoteMessage.data.type === 'NEW_RIDE_REQUEST' && remoteMessage.data.rideId) {
        //   navigation.navigate('DriverDashboard', { rideIdToFocus: remoteMessage.data.rideId });
        // }
        Alert.alert("Notification Tapped (Background)", `Title: ${remoteMessage.notification?.title}\nBody: ${remoteMessage.notification?.body}\nData: ${JSON.stringify(remoteMessage.data)}`);
    }
  });
}

// Check if app was opened from a quit state by a notification
export async function getInitialNotification(navigation) { // Pass navigation ref
  const remoteMessage = await messaging().getInitialNotification();
  if (remoteMessage) {
    console.log('Driver: Notification caused app to open from quit state:', remoteMessage);
    // Example: if (remoteMessage.data.type === 'NEW_RIDE_REQUEST' && remoteMessage.data.rideId) {
    //   navigation.navigate('DriverDashboard', { rideIdToFocus: remoteMessage.data.rideId });
    // }
     Alert.alert("Notification Tapped (Quit State)", `Title: ${remoteMessage.notification?.title}\nBody: ${remoteMessage.notification?.body}\nData: ${JSON.stringify(remoteMessage.data)}`);
  }
}

// Background message handler (typically in index.js)
// export async function backgroundMessageHandler(remoteMessage) {
//   console.log('Driver: Message handled in the background!', remoteMessage);
// }
// if (Platform.OS !== 'web') {
//    messaging().setBackgroundMessageHandler(backgroundMessageHandler);
// }
