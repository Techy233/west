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
