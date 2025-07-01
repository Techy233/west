// VaMiDzoDriver/src/contexts/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Assuming you'll create a similar api.js for the driver app
// For now, direct import for login/register might be okay, or pass functions
import { loginUser as apiLoginUser, registerDriver as apiRegisterDriver } from '../services/api'; // Placeholder, create this service

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
                const response = await apiLoginUser({ phone_number: phoneNumber, password }); // Ensure this API call is for drivers
                if (response.data && response.data.token && response.data.user?.role === 'driver') {
                    const token = response.data.token;
                    const user = response.data.user;
                    await AsyncStorage.setItem('driverUserToken', token);
                    await AsyncStorage.setItem('driverUserData', JSON.stringify(user));
                    setUserToken(token);
                    setDriverData(user);
                    setIsLoading(false);
                    return { success: true, user };
                } else {
                    setIsLoading(false);
                    const message = response.data.user?.role !== 'driver' ? "Login failed. Not a driver account." : response.data?.message;
                    return { success: false, error: message || "Driver login failed" };
                }
            } catch (error) {
                setIsLoading(false);
                console.error("Driver Context signIn error:", error.response?.data || error.message);
                return { success: false, error: error.response?.data?.message || "An error occurred during driver login." };
            }
        },
        // registerDriver will be similar, calling apiRegisterDriver
        // For now, focusing on sign-in for dashboard access
        signOutDriver: async () => {
            setIsLoading(true);
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
