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
// import { loginUser as apiLoginUser } from '../services/api'; // Will use context now
// import AsyncStorage from '@react-native-async-storage/async-storage'; // Context handles storage
import { useAuth } from '../contexts/AuthContext'; // Import useAuth hook

// Assuming a config file for API base URL
// import apiConfig from '../config/apiConfig';

// Placeholder for a custom button component (can be moved to components folder)
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
    // const [isLoading, setIsLoading] = useState(false); // isLoading will come from AuthContext
    const [error, setError] = useState('');
    const { signIn, isLoading } = useAuth(); // Get signIn function and isLoading from context

    const handleLogin = async () => {
        if (!phoneNumber.trim() || !password.trim()) {
            setError('Phone number and password are required.');
            return;
        }
        // setIsLoading(true); // Context will handle its own loading state
        setError('');

        const result = await signIn(phoneNumber, password);

        if (result && result.success) {
            Alert.alert("Login Successful!", `Welcome, ${result.user.phoneNumber}!`);
            // Navigation to 'Home' will be handled by AppNavigator based on isAuthenticated state from context
            // So, no explicit navigation.replace('Home') here is needed if AppNavigator is set up correctly.
        } else {
            setError(result.error || 'Login failed. Please check your credentials.');
        }
        // setIsLoading(false); // Context handles its own loading state
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
        backgroundColor: '#E9F5FF', // Light sky blue background
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingBottom: 20, // Ensure space at bottom if keyboard is up
    },
    container: {
        paddingHorizontal: 30, // More horizontal padding
        alignItems: 'stretch', // Stretch items like buttons
    },
    title: {
        fontSize: 32, // Larger title
        fontWeight: 'bold',
        color: '#007AFF', // Primary blue
        marginBottom: 15,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 17, // Slightly larger
        color: '#555', // Darker grey
        marginBottom: 35, // More space after subtitle
        textAlign: 'center',
        lineHeight: 24,
    },
    inputField: { // This style is for the wrapper View of CustomInput
        marginBottom: 18,
    },
    loginButton: {
        marginTop: 15,
        backgroundColor: '#007AFF', // Primary blue for login
        paddingVertical: 16, // Taller button
        borderRadius: 25, // Rounded button
    },
    linkButton: {
        marginTop: 22, // More space
        alignItems: 'center', // Center link text
    },
    linkText: {
        color: '#007AFF', // Primary blue
        fontSize: 15, // Slightly larger
        fontWeight: '500',
    },
    errorText: {
        color: '#D32F2F', // Material error red
        marginBottom: 18,
        fontSize: 15, // Slightly larger
        textAlign: 'center',
        fontWeight: '500',
    },
    // Base styles for CustomButton and CustomInput (can be moved to their own files)
    buttonBase: { // Base style for CustomButton's TouchableOpacity
        // paddingVertical: 15, // Defined in loginButton or other specific button styles
        // paddingHorizontal: 20, // Defined in loginButton
        // borderRadius: 8, // Overridden by specific button styles
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 52, // Slightly taller
        width: '100%', // Make buttons full width by default
    },
    buttonTextBase: { // Base style for CustomButton's Text
        color: '#fff',
        fontSize: 17, // Larger text
        fontWeight: '600', // Bolder
    },
    buttonDisabled: {
        backgroundColor: '#B0BEC5', // Blue Grey 200 for disabled
    },
    inputContainerBase: { // Base style for CustomInput's wrapping View
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 10, // More rounded
        borderWidth: 1,
        borderColor: '#CFD8DC', // Blue Grey 100
        paddingHorizontal: 18, // More padding
        minHeight: 52, // Taller input
        justifyContent: 'center',
        elevation: 1, // Subtle shadow for Android
        shadowColor: '#000', // Subtle shadow for iOS
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
    },
    inputBase: { // Base style for CustomInput's TextInput
        fontSize: 16,
        color: '#263238', // Blue Grey 900
    }
});

export default LoginScreen;
