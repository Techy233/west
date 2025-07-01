// Placeholder for AppNavigator.js
// This file will set up the main navigation structure for the Rider app.
// We'll use React Navigation.

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Import screens (create these files in src/screens/)
// import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen'; // Import the actual LoginScreen
// import RegistrationScreen from '../screens/RegistrationScreen';
// import MapScreen from '../screens/MapScreen';
// import RideRequestScreen from '../screens/RideRequestScreen';
// import RideInProgressScreen from '../screens/RideInProgressScreen';
// import ProfileScreen from '../screens/ProfileScreen';
// import RideHistoryScreen from '../screens/RideHistoryScreen';
// import PaymentScreen from '../screens/PaymentScreen';

const Stack = createStackNavigator();

// Dummy components for screens until they are created
const PlaceholderScreen = ({ route }) => {
  const { View, Text, StyleSheet } = require('react-native');
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{route.name || 'Screen'} Placeholder</Text>
      <Text style={styles.textSmall}>(To be implemented)</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 20, fontWeight: 'bold' },
  textSmall: { fontSize: 14, color: 'gray', marginTop: 5 },
});


const AppNavigator = () => {
  const initialRouteName = "Login"; // Or "Home" if user is already logged in

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRouteName}>
        {/* Authentication Stack */}
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Login VaMiDzo' }} />
        <Stack.Screen name="Register" component={PlaceholderScreen} options={{ title: 'Create Account' }} />

        {/* Main App Stack (after login) */}
        <Stack.Screen name="Home" component={PlaceholderScreen} options={{ title: 'VaMiDzo Rider' }}/>
        {/* <Stack.Screen name="MapScreen" component={PlaceholderScreen} options={{ title: 'Book a Ride' }} /> */}
        {/* <Stack.Screen name="RideRequestScreen" component={PlaceholderScreen} options={{ title: 'Requesting Ride' }} /> */}
        {/* <Stack.Screen name="RideInProgress" component={RideInProgressScreen} options={{ title: 'Ride in Progress' }} /> */}

        {/* Other screens accessible from a menu or tabs perhaps */}
        {/* <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} /> */}
        {/* <Stack.Screen name="RideHistory" component={RideHistoryScreen} options={{ title: 'Ride History' }} /> */}
        {/* <Stack.Screen name="Payments" component={PaymentScreen} options={{ title: 'Payment Methods' }} /> */}
        {/* Add more screens as needed */}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
