// VaMiDzoRider/src/screens/LoginScreen.js
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
// import axios from 'axios'; // Or your API service
// import AsyncStorage from '@react-native-async-storage/async-storage'; // For storing token

// Assuming a config file for API base URL
// import apiConfig from '../config/apiConfig';

// Placeholder for a custom button component
const CustomButton = ({ title, onPress, style, textStyle, disabled }) => (
    <TouchableOpacity onPress={onPress} style={[styles.buttonBase, style, disabled && styles.buttonDisabled]} disabled={disabled}>
        <Text style={[styles.buttonTextBase, textStyle]}>{title}</Text>
    </TouchableOpacity>
);

// Placeholder for a custom input component
const CustomInput = ({ value, onChangeText, placeholder, secureTextEntry, keyboardType, style, inputStyle }) => (
    <View style={[styles.inputContainerBase, style]}>
        <TextInput
            style={[styles.inputBase, inputStyle]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType || 'default'}
            placeholderTextColor="#888"
        />
    </View>
);


const LoginScreen = ({ navigation }) => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async () => {
        if (!phoneNumber.trim() || !password.trim()) {
            setError('Phone number and password are required.');
            return;
        }
        setIsLoading(true);
        setError('');

        try {
            // --- Replace with actual API call ---
            // Example: const response = await axios.post(`${apiConfig.baseUrl}/auth/login`, {
            //     phone_number: phoneNumber,
            //     password: password,
            // });

            // Simulate API Call
            await new Promise(resolve => setTimeout(resolve, 1500));
            // const MOCK_TOKEN = "mock_jwt_token_for_rider";
            // const MOCK_USER = { userId: 'rider123', phoneNumber, role: 'rider' };

            // if (response.data && response.data.token) {
            //     await AsyncStorage.setItem('userToken', response.data.token);
            //     await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));

            //     // Navigate to Home screen or main part of the app
            //     // This depends on your navigation setup.
            //     // Example: navigation.replace('Home'); // Or a specific stack like 'MainAppStack'
            //     Alert.alert("Login Successful (Simulated)", `Welcome! Token: ${MOCK_TOKEN}`);
            //     // For now, just navigate to a placeholder 'Home' if it exists in navigator
            //     navigation.navigate('Home', { user: MOCK_USER });
            // } else {
            //     setError(response.data.message || 'Login failed. Please try again.');
            // }
            // --- End of API call section ---

            // Simulated success:
            if (phoneNumber === "0244123456" && password === "password") { // Dummy credentials
                Alert.alert("Login Successful (Simulated)", "Welcome back!");
                navigation.replace('Home'); // Assuming 'Home' is a route in your AppNavigator
            } else {
                 setError('Invalid credentials (simulated). Try 0244123456 / password');
            }

        } catch (err) {
            console.error("Login error:", err);
            // const errorMessage = err.response?.data?.message || err.message || 'An unexpected error occurred.';
            // setError(errorMessage);
            setError('An unexpected error occurred during login (simulated).');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardAvoidingContainer}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.container}>
                    <Text style={styles.title}>Welcome Back, Rider!</Text>
                    <Text style={styles.subtitle}>Login to continue your journey.</Text>

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <CustomInput
                        placeholder="Phone Number (e.g., 0244123456)"
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        keyboardType="phone-pad"
                        style={styles.inputField}
                    />
                    <CustomInput
                        placeholder="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        style={styles.inputField}
                    />

                    <CustomButton
                        title={isLoading ? "Logging In..." : "Login"}
                        onPress={handleLogin}
                        disabled={isLoading}
                        style={styles.loginButton}
                    />

                    <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.linkButton}>
                        <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => Alert.alert("Forgot Password", "Forgot password functionality to be implemented.")} style={styles.linkButton}>
                        <Text style={styles.linkText}>Forgot Password?</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    keyboardAvoidingContainer: {
        flex: 1,
        backgroundColor: '#f7f7f7',
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    container: {
        padding: 25,
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 30,
        textAlign: 'center',
    },
    inputField: {
        marginBottom: 20,
        width: '100%',
    },
    loginButton: {
        marginTop: 10,
        backgroundColor: '#FF6347', // Tomato color, adjust to your theme
        width: '100%',
    },
    linkButton: {
        marginTop: 20,
    },
    linkText: {
        color: '#FF6347', // Tomato color
        fontSize: 14,
    },
    errorText: {
        color: 'red',
        marginBottom: 15,
        fontSize: 14,
        textAlign: 'center',
    },
    // Base styles for CustomButton and CustomInput (can be moved to their own files)
    buttonBase: {
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 50,
    },
    buttonTextBase: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonDisabled: {
        backgroundColor: '#ccc',
    },
    inputContainerBase: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        paddingHorizontal: 15,
        minHeight: 50,
        justifyContent: 'center',
    },
    inputBase: {
        fontSize: 16,
        color: '#333',
    }
});

export default LoginScreen;
