// VaMiDzoDriver/src/screens/DriverLoginScreen.js
import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
    ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { useAuthDriver } from '../contexts/AuthContext'; // Use driver-specific auth context

// Reusable components (can be moved to a shared components folder or Driver app's components)
const CustomButton = ({ title, onPress, style, textStyle, disabled }) => (
    <TouchableOpacity onPress={onPress} style={[styles.buttonBase, style, disabled && styles.buttonDisabled]} disabled={disabled}>
        <Text style={[styles.buttonTextBase, textStyle]}>{title}</Text>
    </TouchableOpacity>
);
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

const DriverLoginScreen = ({ navigation }) => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { signInDriver, isLoading } = useAuthDriver(); // Use signInDriver from context

    const handleLogin = async () => {
        if (!phoneNumber.trim() || !password.trim()) {
            setError('Phone number and password are required.');
            return;
        }
        setError('');

        const result = await signInDriver(phoneNumber, password);

        if (result && result.success) {
            // Alert.alert("Login Successful!", `Welcome, Driver ${result.user.firstName || result.user.phoneNumber}!`);
            // Navigation to Dashboard will be handled by AppNavigator based on isAuthenticated state
        } else {
            setError(result.error || 'Login failed. Please check your credentials.');
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardAvoidingContainer}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.container}>
                    <Text style={styles.title}>Driver Login</Text>
                    <Text style={styles.subtitle}>Access your VaMiDzo Driver account.</Text>

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

                    <TouchableOpacity onPress={() => navigation.navigate('DriverRegister')} style={styles.linkButton}>
                        <Text style={styles.linkText}>Don't have a driver account? Sign Up</Text>
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
    keyboardAvoidingContainer: { flex: 1, backgroundColor: '#f0f8ff' }, // AliceBlue for driver theme
    scrollContainer: { flexGrow: 1, justifyContent: 'center' },
    container: { padding: 25, alignItems: 'center' },
    title: { fontSize: 28, fontWeight: 'bold', color: '#007bff', marginBottom: 10, textAlign: 'center' }, // Blue theme
    subtitle: { fontSize: 16, color: '#555', marginBottom: 30, textAlign: 'center' },
    inputField: { marginBottom: 20, width: '100%' },
    loginButton: { marginTop: 10, backgroundColor: '#007bff', width: '100%' }, // Blue theme
    linkButton: { marginTop: 20 },
    linkText: { color: '#007bff', fontSize: 14 },
    errorText: { color: 'red', marginBottom: 15, fontSize: 14, textAlign: 'center' },
    buttonBase: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
    buttonTextBase: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    buttonDisabled: { backgroundColor: '#ccc' },
    inputContainerBase: { width: '100%', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#b0c4de', paddingHorizontal: 15, minHeight: 50, justifyContent: 'center' }, // LightSteelBlue border
    inputBase: { fontSize: 16, color: '#333' }
});

export default DriverLoginScreen;
