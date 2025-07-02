// VaMiDzoRider/src/services/notificationService.js
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
      console.log('Rider Notification Authorization status:', authStatus);
      return true;
    } else {
      console.log('Rider Notification Authorization status: Denied or Not Determined');
      // Alert.alert("Push Notifications Disabled", "Please enable notifications in settings to receive ride updates.");
      return false;
    }
  } else { // Android
    // Android does not require explicit permission request for FCM for basic notifications on most versions
    // However, for Android 13 (API level 33) and above, POST_NOTIFICATIONS permission is needed.
    // react-native-firebase handles this if targetSDK is appropriate.
    // For simplicity here, we assume it's granted or handled by RNFirebase.
    // You might add specific permission request for Android 13+ using react-native-permissions if needed.
    console.log('Assuming Android notification permission is granted or handled by OS/RNFirebase.');
    return true;
  }
}

// Get FCM token and send to backend
export async function getAndSendDeviceToken(userId) {
  if (!userId) {
    console.warn("Cannot send device token without userId.");
    return;
  }
  try {
    const hasPermission = await requestNotificationPermission(); // Ensure permission first
    if (!hasPermission && Platform.OS === 'ios') { // On Android, getToken might work even if explicit perm isn't asked this way
        console.log("No notification permission, cannot get or send token.");
        return;
    }

    const fcmToken = await messaging().getToken();
    if (fcmToken) {
      console.log('Rider FCM Token:', fcmToken);
      const storedToken = await AsyncStorage.getItem('fcmDeviceToken_rider');

      // Send if new or different from stored one
      if (fcmToken !== storedToken) {
        await apiClient.post('/users/me/device-token', {
          device_token: fcmToken,
          device_type: Platform.OS, // 'ios' or 'android'
        });
        await AsyncStorage.setItem('fcmDeviceToken_rider', fcmToken);
        console.log('Rider FCM token sent to server and stored locally.');
      } else {
        console.log('Rider FCM token is current, no need to resend.');
      }
    } else {
      console.log('Failed to get FCM token for rider.');
    }
  } catch (error) {
    console.error('Error getting/sending FCM token for rider:', error.response?.data || error.message);
  }
}

// Listener for when a new token is generated (e.g., on app reinstall or token refresh)
export function onTokenRefreshListener() {
    return messaging().onTokenRefresh(async (newFcmToken) => {
        console.log('Rider FCM Token refreshed:', newFcmToken);
        // Need userId to send. This listener might be active before user logs in.
        // So, store it and send when user logs in, or get userId from AsyncStorage if available.
        const userDataString = await AsyncStorage.getItem('userData'); // Key from AuthContext
        if (userDataString) {
            const userData = JSON.parse(userDataString);
            if (userData && userData.userId) {
                 try {
                    await apiClient.post('/users/me/device-token', {
                        device_token: newFcmToken,
                        device_type: Platform.OS,
                    });
                    await AsyncStorage.setItem('fcmDeviceToken_rider', newFcmToken);
                    console.log('Refreshed Rider FCM token sent to server.');
                } catch (error) {
                    console.error('Error sending refreshed FCM token for rider:', error);
                }
            } else {
                 // Store new token to be sent later upon login
                 await AsyncStorage.setItem('pendingFcmDeviceToken_rider', newFcmToken);
                 console.log('User not logged in. Storing refreshed token to send upon login.');
            }
        } else {
            await AsyncStorage.setItem('pendingFcmDeviceToken_rider', newFcmToken);
            console.log('User not logged in. Storing refreshed token to send upon login.');
        }
    });
}

// Handle foreground messages
export function onForegroundMessageListener() {
  return messaging().onMessage(async remoteMessage => {
    console.log('Rider: A new FCM message arrived in foreground!', JSON.stringify(remoteMessage));
    // Display an in-app notification or update UI
    Alert.alert(
      remoteMessage.notification?.title || 'New Notification',
      remoteMessage.notification?.body || 'You have a new message.',
      [{ text: 'OK'}]
    );
    // You can also access data payload: remoteMessage.data
  });
}

// Handle background/quit state messages (user taps on notification)
// This should be set up in index.js or App.js (root)
export function onNotificationOpenedAppListener(navigation) { // Pass navigation ref
  return messaging().onNotificationOpenedApp(remoteMessage => {
    console.log('Rider: Notification caused app to open from background state:', remoteMessage);
    if (remoteMessage) {
        // Navigate to a specific screen based on remoteMessage.data
        // Example: if (remoteMessage.data.type === 'ride_update' && remoteMessage.data.rideId) {
        //   navigation.navigate('RideStatus', { rideId: remoteMessage.data.rideId });
        // }
        Alert.alert("Notification Tapped (Background)", `Title: ${remoteMessage.notification?.title}\nBody: ${remoteMessage.notification?.body}\nData: ${JSON.stringify(remoteMessage.data)}`);
    }
  });
}

// Check if app was opened from a quit state by a notification
// This should be called once when the app initializes (e.g. in App.js)
export async function getInitialNotification(navigation) { // Pass navigation ref
  const remoteMessage = await messaging().getInitialNotification();
  if (remoteMessage) {
    console.log('Rider: Notification caused app to open from quit state:', remoteMessage);
    // Navigate to a specific screen based on remoteMessage.data
    // Example: if (remoteMessage.data.type === 'ride_update' && remoteMessage.data.rideId) {
    //   navigation.navigate('RideStatus', { rideId: remoteMessage.data.rideId });
    // }
    Alert.alert("Notification Tapped (Quit State)", `Title: ${remoteMessage.notification?.title}\nBody: ${remoteMessage.notification?.body}\nData: ${JSON.stringify(remoteMessage.data)}`);
  }
}

// Background message handler (must be outside React component tree, typically in index.js)
// export async function backgroundMessageHandler(remoteMessage) {
//   console.log('Rider: Message handled in the background!', remoteMessage);
//   // You can perform background tasks here, but UI updates are limited.
//   // This is also where you might schedule a local notification if needed.
// }
// if (Platform.OS !== 'web') { // Background handler not for web
//    messaging().setBackgroundMessageHandler(backgroundMessageHandler);
// }
