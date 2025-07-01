// VaMiDzoDriver/src/screens/DriverRegistrationScreen.js
import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
    ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useAuthDriver } from '../contexts/AuthContext';

// Reusable components (can be moved)
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

const DriverRegistrationScreen = ({ navigation }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [licenseNumber, setLicenseNumber] = useState('');
    const [vehiclePlateNumber, setVehiclePlateNumber] = useState('');
    const [vehicleModel, setVehicleModel] = useState('');
    const [vehicleColor, setVehicleColor] = useState('');
    const [vehicleYear, setVehicleYear] = useState('');

    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const { signUpDriver, isLoading } = useAuthDriver();

    const validateForm = () => {
        const errors = {};
        if (!firstName.trim()) errors.firstName = "First name is required.";
        if (!lastName.trim()) errors.lastName = "Last name is required.";
        if (!phoneNumber.trim()) errors.phoneNumber = "Phone number is required.";
        else if (!/^[0-9]{10,15}$/.test(phoneNumber)) errors.phoneNumber = "Invalid phone number format.";

        if (!password) errors.password = "Password is required.";
        else if (password.length < 8) errors.password = "Password must be at least 8 characters.";
        else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/.test(password)) {
            errors.password = "Needs uppercase, lowercase, digit, & special char.";
        }
        if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";

        if (!licenseNumber.trim()) errors.licenseNumber = "License number is required.";
        if (!vehiclePlateNumber.trim()) errors.vehiclePlateNumber = "Vehicle plate number is required.";
        // Optional fields don't need client-side presence validation unless specific format needed
        if (vehicleYear.trim() && !/^\d{4}$/.test(vehicleYear.trim())) errors.vehicleYear = "Invalid year format (YYYY).";


        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleRegistration = async () => {
        setError('');
        if (!validateForm()) {
            setError("Please correct the errors shown below.");
            return;
        }

        const driverRegData = {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone_number: phoneNumber.trim(),
            password: password,
            license_number: licenseNumber.trim(),
            vehicle_plate_number: vehiclePlateNumber.trim(),
            vehicle_model: vehicleModel.trim() || null,
            vehicle_color: vehicleColor.trim() || null,
            vehicle_year: vehicleYear.trim() ? parseInt(vehicleYear.trim()) : null,
            // profile_picture_url: null // Handle separately if needed
        };

        const result = await signUpDriver(driverRegData);

        if (result && result.success) {
            Alert.alert(
                "Registration Submitted!",
                result.message || "Your application is submitted. Please login after verification.",
                [{ text: "OK", onPress: () => navigation.navigate('DriverLogin') }]
            );
        } else {
            setError(result.error || 'Registration failed. Please try again.');
            if (result.errors) {
                const backendFieldErrors = {};
                result.errors.forEach(err => {
                    const fieldName = (Array.isArray(err.field) ? err.field[0] : err.field).replace('_', '');
                    backendFieldErrors[fieldName] = err.message;
                });
                setFieldErrors(prev => ({...prev, ...backendFieldErrors}));
            } else if (result.error?.toLowerCase().includes('phone number already exists') || result.error?.toLowerCase().includes('phone detail already exists')) {
                 setFieldErrors(prev => ({...prev, phoneNumber: 'This phone number is already registered.'}));
            } else if (result.error?.toLowerCase().includes('license number already registered')) {
                 setFieldErrors(prev => ({...prev, licenseNumber: 'This license number is already registered.'}));
            } else if (result.error?.toLowerCase().includes('vehicle plate number already registered')) {
                 setFieldErrors(prev => ({...prev, vehiclePlateNumber: 'This vehicle plate is already registered.'}));
            }
        }
    };


    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.kbView}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.container}>
                    <Text style={styles.title}>Driver Registration</Text>
                    <Text style={styles.subtitle}>Join VaMiDzo as a driver partner.</Text>

                    {error && <Text style={styles.errorTextGlobal}>{error}</Text>}

                    <SectionTitle title="Personal Information" />
                    <CustomInput placeholder="First Name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
                    {fieldErrors.firstName && <Text style={styles.errorText}>{fieldErrors.firstName}</Text>}
                    <CustomInput placeholder="Last Name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
                    {fieldErrors.lastName && <Text style={styles.errorText}>{fieldErrors.lastName}</Text>}
                    <CustomInput placeholder="Phone Number" value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" />
                    {fieldErrors.phoneNumber && <Text style={styles.errorText}>{fieldErrors.phoneNumber}</Text>}
                    <CustomInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
                    {fieldErrors.password && <Text style={styles.errorText}>{fieldErrors.password}</Text>}
                    <CustomInput placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
                    {fieldErrors.confirmPassword && <Text style={styles.errorText}>{fieldErrors.confirmPassword}</Text>}

                    <SectionTitle title="Driver & Vehicle Information" />
                    <CustomInput placeholder="Driver's License Number" value={licenseNumber} onChangeText={setLicenseNumber} autoCapitalize="characters" />
                    {fieldErrors.licenseNumber && <Text style={styles.errorText}>{fieldErrors.licenseNumber}</Text>}
                    <CustomInput placeholder="Vehicle Plate Number" value={vehiclePlateNumber} onChangeText={setVehiclePlateNumber} autoCapitalize="characters" />
                    {fieldErrors.vehiclePlateNumber && <Text style={styles.errorText}>{fieldErrors.vehiclePlateNumber}</Text>}
                    <CustomInput placeholder="Vehicle Model (e.g., Toyota Corolla)" value={vehicleModel} onChangeText={setVehicleModel} autoCapitalize="words" />
                    {fieldErrors.vehicleModel && <Text style={styles.errorText}>{fieldErrors.vehicleModel}</Text>}
                     <CustomInput placeholder="Vehicle Color (e.g., Blue)" value={vehicleColor} onChangeText={setVehicleColor} autoCapitalize="words" />
                    {fieldErrors.vehicleColor && <Text style={styles.errorText}>{fieldErrors.vehicleColor}</Text>}
                    <CustomInput placeholder="Vehicle Year (YYYY)" value={vehicleYear} onChangeText={setVehicleYear} keyboardType="numeric" maxLength={4} />
                    {fieldErrors.vehicleYear && <Text style={styles.errorText}>{fieldErrors.vehicleYear}</Text>}

                    <View style={{height: 20}} />
                    <CustomButton
                        title={isLoading ? "Submitting..." : "Register as Driver"}
                        onPress={handleRegistration}
                        disabled={isLoading}
                        style={styles.registerButton}
                    />
                    <TouchableOpacity onPress={() => navigation.navigate('DriverLogin')} style={styles.linkButton}>
                        <Text style={styles.linkText}>Already have a driver account? Login</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const SectionTitle = ({ title }) => <Text style={styles.sectionTitle}>{title}</Text>;

const styles = StyleSheet.create({
    kbView: { flex: 1, backgroundColor: '#f0f8ff' },
    scrollContainer: { flexGrow: 1, justifyContent: 'center', paddingVertical: 20 },
    container: { paddingHorizontal: 25 },
    title: { fontSize: 26, fontWeight: 'bold', color: '#007bff', marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 15, color: '#555', marginBottom: 20, textAlign: 'center' },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 20, marginBottom: 10, borderBottomWidth:1, borderBottomColor:'#eee', paddingBottom:5 },
    inputContainerBase: { marginBottom: 8 }, // Reduce bottom margin for tighter packing with errors
    inputBase: { fontSize: 15, paddingVertical:10 },
    registerButton: { marginTop: 25, backgroundColor: '#28a745', width: '100%' },
    linkButton: { marginTop: 20, alignItems: 'center' },
    linkText: { color: '#007bff', fontSize: 14 },
    errorTextGlobal: { color: 'red', marginBottom: 10, fontSize: 14, textAlign: 'center' },
    errorText: { color: 'red', alignSelf: 'flex-start', marginLeft: 5, marginBottom: 8, fontSize: 12 },
    buttonBase: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
    buttonTextBase: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    buttonDisabled: { backgroundColor: '#ccc' },
});

export default DriverRegistrationScreen;
