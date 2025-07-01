// VaMiDzoRider/src/navigation/AppNavigator.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

// Import screens
import LoginScreen from '../screens/LoginScreen';
import RegistrationScreen from '../screens/RegistrationScreen';
import SplashScreen from '../screens/SplashScreen'; // Import SplashScreen
// import HomeScreen from '../screens/HomeScreen'; // Placeholder for main app screen
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

// Define Auth stack
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegistrationScreen} />
  </Stack.Navigator>
);

// Define Main App stack (placeholder for now)
import HomeScreen from '../screens/HomeScreen'; // Import actual HomeScreen
import ProfileScreen from '../screens/ProfileScreen'; // Import ProfileScreen
import RequestRideScreen from '../screens/RequestRideScreen'; // Import RequestRideScreen
import RideStatusScreen from '../screens/RideStatusScreen'; // Import RideStatusScreen
import MapScreen from '../screens/MapScreen'; // Import MapScreen


const MainAppStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'VaMiDzo Rider' }}/>
    <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }}/>
    <Stack.Screen name="RequestRide" component={RequestRideScreen} options={{ title: 'Request a Ride' }}/>
    <Stack.Screen name="RideStatus" component={RideStatusScreen} options={{ title: 'Ride Status' }}/>
    <Stack.Screen name="MapDisplay" component={MapScreen} options={{ title: 'View Map' }} />
    {/* Add other main app screens here: RideHistoryScreen etc. */}
  </Stack.Navigator>
);


const AppNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    // Show a splash screen or loading indicator while checking auth state
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainAppStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default AppNavigator;
