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
    keyboardAvoidingContainer: {
        flex: 1,
        backgroundColor: '#f7f7f7',
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingVertical: 20, // Add padding for scroll view content
    },
    container: {
        paddingHorizontal: 25,
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
        marginBottom: 20, // Reduced margin
        textAlign: 'center',
    },
    inputField: {
        marginBottom: 5, // Reduced margin for tighter packing with error messages
        width: '100%',
    },
    registerButton: {
        marginTop: 15, // Adjusted margin
        backgroundColor: '#28a745', // Green color for registration
        width: '100%',
    },
    linkButton: {
        marginTop: 20,
    },
    linkText: {
        color: '#FF6347', // Tomato color, consistent with LoginScreen
        fontSize: 14,
    },
    errorTextGlobal: {
        color: 'red',
        marginBottom: 10, // Margin for global error
        fontSize: 14,
        textAlign: 'center',
    },
    errorText: { // Field specific error
        color: 'red',
        alignSelf: 'flex-start',
        marginLeft: 5, // Indent slightly
        marginBottom: 10, // Space before next input
        fontSize: 12,
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

export default RegistrationScreen;
