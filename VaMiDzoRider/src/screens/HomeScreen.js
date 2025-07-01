// VaMiDzoRider/src/screens/HomeScreen.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

// Reusable Button (can be moved to components)
const CustomButton = ({ title, onPress, style, textStyle }) => (
    <TouchableOpacity onPress={onPress} style={[styles.buttonBase, style]}>
        <Text style={[styles.buttonTextBase, textStyle]}>{title}</Text>
    </TouchableOpacity>
);

const HomeScreen = ({ navigation }) => {
    const { userData, signOut, userToken } = useAuth();

    const handleLogout = async () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to logout?",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Logout",
                    onPress: async () => {
                        await signOut();
                        // Navigation to AuthStack will be handled by AppNavigator due to isAuthenticated changing
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Welcome to VaMiDzo!</Text>
            {userData ? (
                <Text style={styles.userInfo}>
                    Logged in as: {userData.first_name || userData.phoneNumber} ({userData.role})
                </Text>
            ) : (
                <Text style={styles.userInfo}>Loading user data...</Text>
            )}
            {/* <Text style={styles.tokenInfo}>Token: {userToken ? userToken.substring(0,30) + '...' : 'No Token'}</Text> */}

            <Text style={styles.instructions}>
                This is the main application screen area.
                Map, ride booking, and other features will be built out from here.
            </Text>

            {/* Placeholder for other navigation or features */}
            <CustomButton
                title="Go to My Profile"
                onPress={() => navigation.navigate('Profile')} // Navigate to ProfileScreen
                style={styles.featureButton}
            />
             <CustomButton
                title="Book a Ride"
                onPress={() => navigation.navigate('RequestRide')} // Navigate to RequestRideScreen
                style={styles.featureButton}
            />
            <CustomButton
                title="View Map (Test)"
                onPress={() => navigation.navigate('MapDisplay')}
                style={styles.featureButton}
            />

            <CustomButton
                title="Logout"
                onPress={handleLogout}
                style={styles.logoutButton}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
    },
    userInfo: {
        fontSize: 16,
        marginBottom: 10,
        color: '#555',
    },
    tokenInfo: {
        fontSize: 10,
        color: 'gray',
        marginBottom: 20,
        paddingHorizontal: 10,
        textAlign: 'center'
    },
    instructions: {
        fontSize: 14,
        textAlign: 'center',
        color: '#666',
        marginBottom: 30,
        paddingHorizontal: 10,
    },
    buttonBase: {
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 200,
        marginBottom: 15,
    },
    buttonTextBase: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    featureButton: {
        backgroundColor: '#007bff', // Blue for features
    },
    logoutButton: {
        backgroundColor: '#FF6347', // Tomato color for logout
        marginTop: 20,
    }
});

export default HomeScreen;
