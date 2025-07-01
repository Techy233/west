// VaMiDzoRider/src/contexts/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser as apiLoginUser, registerRider as apiRegisterRider } from '../services/api';
import { initSocket as initRiderSocket, disconnectSocket as disconnectRiderSocket } from '../services/socketService'; // Import socket functions

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
                    const parsedUserData = JSON.parse(storedUserData);
                    setUserToken(token);
                    setUserData(parsedUserData);
                    initRiderSocket(parsedUserData.userId); // Initialize socket with rider ID
                }
            } catch (e) {
                console.error("Restoring token failed", e);
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
                    const user = response.data.user; // Expecting { userId, role, ... }
                    await AsyncStorage.setItem('userToken', token);
                    await AsyncStorage.setItem('userData', JSON.stringify(user));
                    setUserToken(token);
                    setUserData(user);
                    if (user.userId) {
                        initRiderSocket(user.userId); // Initialize socket on login
                    }
                    setIsLoading(false);
                    return { success: true, user };
                } else {
                    setIsLoading(false);
                    return { success: false, error: response.data?.message || "Login failed from context" };
                }
            } catch (error) {
                setIsLoading(false);
                console.error("Context signIn error:", error.response?.data || error.message);
                return { success: false, error: error.response?.data?.message || "An error occurred during login." };
            }
        },
        signUpRider: async (riderDetails) => {
            setIsLoading(true);
            try {
                const response = await apiRegisterRider(riderDetails);
                 if (response.data && (response.data.token || response.status === 201)) {
                    // Assuming successful registration doesn't auto-login but returns success message
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
                disconnectRiderSocket(); // Disconnect socket on sign out
            } catch (e) {
                console.error("Signing out failed", e);
            }
            setUserToken(null);
            setUserData(null);
            setIsLoading(false);
        },
        userToken,
        userData, // This should contain { userId, role, ... }
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
