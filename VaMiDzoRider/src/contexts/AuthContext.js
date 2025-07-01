// VaMiDzoRider/src/contexts/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser as apiLoginUser, registerRider as apiRegisterRider } from '../services/api'; // Assuming api service handles actual calls

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [userToken, setUserToken] = useState(null);
    const [userData, setUserData] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // For checking stored token initially

    useEffect(() => {
        // Check for token in AsyncStorage on app startup
        const bootstrapAsync = async () => {
            let token;
            let storedUserData;
            try {
                token = await AsyncStorage.getItem('userToken');
                storedUserData = await AsyncStorage.getItem('userData');
                if (token && storedUserData) {
                    setUserToken(token);
                    setUserData(JSON.parse(storedUserData));
                }
            } catch (e) {
                console.error("Restoring token failed", e);
                // Can also remove token if it's corrupted or invalid
                await AsyncStorage.removeItem('userToken');
                await AsyncStorage.removeItem('userData');
            }
            setIsLoading(false);
        };

        bootstrapAsync();
    }, []);

    const authContextValue = {
        signIn: async (phoneNumber, password) => {
            setIsLoading(true);
            try {
                const response = await apiLoginUser({ phone_number: phoneNumber, password });
                if (response.data && response.data.token) {
                    const token = response.data.token;
                    const user = response.data.user;
                    await AsyncStorage.setItem('userToken', token);
                    await AsyncStorage.setItem('userData', JSON.stringify(user));
                    setUserToken(token);
                    setUserData(user);
                    setIsLoading(false);
                    return { success: true, user };
                } else {
                    setIsLoading(false);
                    // Use message from API response if available, else generic
                    return { success: false, error: response.data?.message || "Login failed from context" };
                }
            } catch (error) {
                setIsLoading(false);
                console.error("Context signIn error:", error.response?.data || error.message);
                return { success: false, error: error.response?.data?.message || "An error occurred during login." };
            }
        },
        signUpRider: async (riderDetails) => { // Example for rider signup
            setIsLoading(true);
            try {
                const response = await apiRegisterRider(riderDetails);
                 if (response.data && response.data.token) { // Assuming registration also returns a token (or just success)
                    // Typically, after registration, user should login.
                    // Or, if backend auto-logs in, handle token and user data.
                    // For this example, let's assume it returns success and user should login.
                    setIsLoading(false);
                    return { success: true, message: response.data.message || "Registration successful. Please login."};
                } else {
                    setIsLoading(false);
                    return { success: false, error: response.data?.message || "Registration failed from context", errors: response.data?.errors };
                }
            } catch (error) {
                setIsLoading(false);
                console.error("Context signUpRider error:", error.response?.data || error.message);
                return {
                    success: false,
                    error: error.response?.data?.message || "An error occurred during registration.",
                    errors: error.response?.data?.errors
                };
            }
        },
        signOut: async () => {
            setIsLoading(true);
            try {
                await AsyncStorage.removeItem('userToken');
                await AsyncStorage.removeItem('userData');
            } catch (e) {
                console.error("Signing out failed", e);
            }
            setUserToken(null);
            setUserData(null);
            setIsLoading(false);
        },
        userToken,
        userData,
        isAuthenticated: !!userToken, // True if userToken is not null
        isLoading // To show loading indicator while checking token or during login/signup
    };

    return (
        <AuthContext.Provider value={authContextValue}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use the auth context
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
