// VaMiDzoRider/src/screens/RegistrationScreen.js
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    ScrollView,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
// import { registerRider as apiRegisterRider } from '../services/api'; // Will use context now
import { useAuth } from '../contexts/AuthContext'; // Import useAuth hook
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import apiConfig from '../config/apiConfig'; // Assuming a config file

// Reusable components (can be moved to ../components)
const CustomButton = ({ title, onPress, style, textStyle, disabled }) => (
    <TouchableOpacity onPress={onPress} style={[styles.buttonBase, style, disabled && styles.buttonDisabled]} disabled={disabled}>
        <Text style={[styles.buttonTextBase, textStyle]}>{title}</Text>
    </TouchableOpacity>
);

const CustomInput = ({ value, onChangeText, placeholder, secureTextEntry, keyboardType, style, inputStyle, autoCapitalize }) => (
    <View style={[styles.inputContainerBase, style]}>
        <TextInput
            style={[styles.inputBase, inputStyle]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType || 'default'}
            placeholderTextColor="#888"
            autoCapitalize={autoCapitalize || 'sentences'}
        />
    </View>
);


const RegistrationScreen = ({ navigation }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    // const [isLoading, setIsLoading] = useState(false); // Will come from context
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const { signUpRider, isLoading } = useAuth(); // Get signUpRider and isLoading from context


    const validateForm = () => {
        const errors = {};
        if (!firstName.trim()) errors.firstName = "First name is required.";
        if (!lastName.trim()) errors.lastName = "Last name is required.";
        if (!phoneNumber.trim()) errors.phoneNumber = "Phone number is required.";
        else if (!/^[0-9]{10,15}$/.test(phoneNumber)) errors.phoneNumber = "Invalid phone number format.";

        if (!password) errors.password = "Password is required.";
        else if (password.length < 8) errors.password = "Password must be at least 8 characters.";
        // Add more complex regex if needed, matching backend Joi schema
        else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/.test(password)) {
            errors.password = "Password needs uppercase, lowercase, digit, and special character.";
        }

        if (!confirmPassword) errors.confirmPassword = "Confirm password is required.";
        else if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };


    const handleRegistration = async () => {
        setError(''); // Clear global error
        if (!validateForm()) {
            setError("Please correct the errors above."); // Optional global error message
            return;
        }
        // setIsLoading(true); // Context handles loading state
        setFieldErrors({}); // Clear previous field errors

        const result = await signUpRider({
            first_name: firstName,
            last_name: lastName,
            phone_number: phoneNumber,
            password: password,
        });

        if (result && result.success) {
            Alert.alert(
                "Registration Successful!",
                result.message || "Please login to continue.",
                [{ text: "OK", onPress: () => navigation.navigate('Login') }]
            );
        } else {
            setError(result.error || 'Registration failed. Please try again.');
            if (result.errors) { // Handle field-specific errors from context/API
                const backendFieldErrors = {};
                result.errors.forEach(err => {
                    const fieldName = (Array.isArray(err.field) ? err.field[0] : err.field).replace('_', '');
                    backendFieldErrors[fieldName] = err.message;
                });
                setFieldErrors(backendFieldErrors);
            } else if (result.error?.toLowerCase().includes('phone number already exists')) {
                 setFieldErrors({phoneNumber: 'This phone number is already registered.'});
            }
        }
        // setIsLoading(false); // Context handles loading state
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardAvoidingContainer}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.container}>
                    <Text style={styles.title}>Create Rider Account</Text>
                    <Text style={styles.subtitle}>Join the VaMiDzo community!</Text>

                    {error && <Text style={styles.errorTextGlobal}>{error}</Text>}

                    <CustomInput
                        placeholder="First Name"
                        value={firstName}
                        onChangeText={setFirstName}
                        style={styles.inputField}
                        autoCapitalize="words"
                    />
                    {fieldErrors.firstName && <Text style={styles.errorText}>{fieldErrors.firstName}</Text>}

                    <CustomInput
                        placeholder="Last Name"
                        value={lastName}
                        onChangeText={setLastName}
                        style={styles.inputField}
                        autoCapitalize="words"
                    />
                    {fieldErrors.lastName && <Text style={styles.errorText}>{fieldErrors.lastName}</Text>}

                    <CustomInput
                        placeholder="Phone Number (e.g., 0244123456)"
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        keyboardType="phone-pad"
                        style={styles.inputField}
                    />
                    {fieldErrors.phoneNumber && <Text style={styles.errorText}>{fieldErrors.phoneNumber}</Text>}

                    <CustomInput
                        placeholder="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        style={styles.inputField}
                    />
                    {fieldErrors.password && <Text style={styles.errorText}>{fieldErrors.password}</Text>}

                    <CustomInput
                        placeholder="Confirm Password"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        style={styles.inputField}
                    />
                    {fieldErrors.confirmPassword && <Text style={styles.errorText}>{fieldErrors.confirmPassword}</Text>}

                    <CustomButton
                        title={isLoading ? "Registering..." : "Register"}
                        onPress={handleRegistration}
                        disabled={isLoading}
                        style={styles.registerButton}
                    />

                    <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkButton}>
                        <Text style={styles.linkText}>Already have an account? Login</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    kbView: { flex: 1, backgroundColor: '#E9F5FF' }, // Consistent light sky blue
    scrollContainer: { flexGrow: 1, justifyContent: 'center', paddingVertical: 30 }, // More vertical padding
    container: { paddingHorizontal: 30, alignItems: 'stretch' }, // Stretch for full-width elements
    title: { fontSize: 30, fontWeight: 'bold', color: '#007AFF', marginBottom: 12, textAlign: 'center' }, // Primary blue
    subtitle: { fontSize: 16, color: '#555', marginBottom: 25, textAlign: 'center', lineHeight: 22 },
    sectionTitle: {
        fontSize: 18, fontWeight: '600', color: '#34495e', // Wet Asphalt
        marginTop: 20, marginBottom: 12,
        borderBottomWidth:1, borderBottomColor:'#CFD8DC', // Blue Grey 100
        paddingBottom:8
    },
    inputContainerBase: { // Style for the wrapper View of CustomInput
        marginBottom: 8, // Tighter packing for fields within a section
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#CFD8DC',
        paddingHorizontal: 18,
        minHeight: 52,
        justifyContent: 'center',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
    },
    inputBase: { // Style for the TextInput itself
        fontSize: 16,
        color: '#263238', // Blue Grey 900
    },
    registerButton: {
        marginTop: 30,
        backgroundColor: '#28a745', // Keep green for register action
        paddingVertical: 16,
        borderRadius: 25,
        width: '100%',
    },
    linkButton: { marginTop: 25, alignItems: 'center' },
    linkText: { color: '#007AFF', fontSize: 15, fontWeight: '500' },
    errorTextGlobal: { color: '#D32F2F', marginBottom: 15, fontSize: 15, textAlign: 'center', fontWeight: '500'},
    errorText: { // Field specific error
        color: '#D32F2F',
        alignSelf: 'flex-start',
        marginLeft: 8, // Slight indent
        marginBottom: 12, // Space before next input section or button
        fontSize: 13, // Slightly larger
        fontWeight: '500',
    },
    // Base styles for CustomButton (TouchableOpacity part)
    buttonBase: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 52,
        width: '100%', // Make buttons full width by default in this screen
    },
    buttonTextBase: { color: '#fff', fontSize: 17, fontWeight: '600' },
    buttonDisabled: { backgroundColor: '#B0BEC5' },
});

export default RegistrationScreen;
