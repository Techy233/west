// VaMiDzoDriver/src/contexts/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Assuming you'll create a similar api.js for the driver app
import * as api from '../services/api'; // Import all from api service

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [userToken, setUserToken] = useState(null); // Driver's JWT
    const [driverData, setDriverData] = useState(null); // Driver-specific data
    const [isLoading, setIsLoading] = useState(true); // For checking stored token

    useEffect(() => {
        const bootstrapAsync = async () => {
            let token;
            let storedDriverData;
            try {
                token = await AsyncStorage.getItem('driverUserToken'); // Use a different key for driver
                storedDriverData = await AsyncStorage.getItem('driverUserData');
                if (token && storedDriverData) {
                    setUserToken(token);
                    setDriverData(JSON.parse(storedDriverData));
                }
            } catch (e) {
                console.error("Restoring driver token failed", e);
                await AsyncStorage.removeItem('driverUserToken');
                await AsyncStorage.removeItem('driverUserData');
            }
            setIsLoading(false);
        };
        bootstrapAsync();
    }, []);

    const authContextValue = {
        signInDriver: async (phoneNumber, password) => {
            setIsLoading(true);
            try {
                const response = await api.loginUser({ phone_number: phoneNumber, password }); // Using api.loginUser
                if (response.data && response.data.token && response.data.user?.role === 'driver') {
                    const token = response.data.token;
                    const user = response.data.user;
                    await AsyncStorage.setItem('driverUserToken', token);
                    await AsyncStorage.setItem('driverUserData', JSON.stringify(user));
                    setUserToken(token);
                    setDriverData(user);
                    // TODO: Initialize driver socket here if not already done by useEffect
                    // initDriverSocket(user.userId);
                    setIsLoading(false);
                    return { success: true, user };
                } else {
                    setIsLoading(false);
                    const message = response.data?.user?.role !== 'driver' ? "Login failed. Not a driver account." : response.data?.message;
                    return { success: false, error: message || "Driver login failed" };
                }
            } catch (error) {
                setIsLoading(false);
                console.error("Driver Context signIn error:", error.response?.data || error.message);
                return { success: false, error: error.response?.data?.message || "An error occurred during driver login." };
            }
        },
        signUpDriver: async (driverRegData) => {
            setIsLoading(true);
            try {
                const response = await api.registerDriver(driverRegData);
                if (response.data && (response.data.token || response.status === 201)) {
                     setIsLoading(false);
                    return { success: true, message: response.data.message || "Registration successful. Please login."};
                } else {
                    setIsLoading(false);
                    return { success: false, error: response.data?.message || "Driver registration failed", errors: response.data?.errors };
                }
            } catch (error) {
                setIsLoading(false);
                console.error("Driver Context signUp error:", error.response?.data || error.message);
                return { success: false, error: error.response?.data?.message || "An error occurred during driver registration.", errors: error.response?.data?.errors };
            }
        },
        signOutDriver: async () => {
            setIsLoading(true);
            // TODO: Disconnect socket if using socketService
            // disconnectDriverSocket();
            try {
                await AsyncStorage.removeItem('driverUserToken');
                await AsyncStorage.removeItem('driverUserData');
            } catch (e) {
                console.error("Driver signing out failed", e);
            }
            setUserToken(null);
            setDriverData(null);
            setIsLoading(false);
        },
        userToken,
        driverData, // Specifically driverData
        isAuthenticated: !!userToken, // Based on driver's token
        isLoading
    };

    return (
        <AuthContext.Provider value={authContextValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuthDriver = () => { // Custom hook for driver auth
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuthDriver must be used within an AuthDriverProvider'); // Corrected Provider name if different
    }
    return context;
};
