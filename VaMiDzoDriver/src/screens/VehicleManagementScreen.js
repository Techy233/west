// VaMiDzoDriver/src/screens/VehicleManagementScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator, TextInput, TouchableOpacity } from 'react-native';
// import { useAuth } from '../contexts/AuthContext'; // If needed for driver data
// import { getMyVehicleInfo, updateMyVehicleInfo } from '../services/api'; // Assuming these exist or are created

// Reusable components
const CustomButton = ({ title, onPress, style, textStyle, disabled }) => (
    <TouchableOpacity onPress={onPress} style={[styles.buttonBase, style, disabled && styles.buttonDisabled]} disabled={disabled}>
        <Text style={[styles.buttonTextBase, textStyle]}>{title}</Text>
    </TouchableOpacity>
);
const CustomInput = ({ value, onChangeText, placeholder, style, inputStyle, editable = true, keyboardType }) => (
    <View style={[styles.inputContainerBase, style, !editable && styles.inputDisabled_Container]}>
        <TextInput
            style={[styles.inputBase, inputStyle, !editable && styles.inputDisabled_Text]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#888"
            editable={editable}
            keyboardType={keyboardType || 'default'}
        />
    </View>
);


const VehicleManagementScreen = ({ navigation }) => {
    // const { userData } = useAuth(); // Assuming driver specific data might be in AuthContext or fetched
    const [isLoading, setIsLoading] = useState(false); // For fetching vehicle info
    const [isUpdating, setIsUpdating] = useState(false); // For updating vehicle info
    const [error, setError] = useState('');

    // Vehicle details state - initialize with current driver's vehicle or empty
    const [vehicleModel, setVehicleModel] = useState('');
    const [vehicleColor, setVehicleColor] = useState('');
    const [vehicleYear, setVehicleYear] = useState('');
    const [vehiclePlateNumber, setVehiclePlateNumber] = useState(''); // Usually not editable post-verification

    // useEffect(() => {
    //     const fetchVehicleInfo = async () => {
    //         setIsLoading(true);
    //         try {
    //             // const response = await getMyVehicleInfo(); // API call
    //             // if (response.data) {
    //             //     setVehicleModel(response.data.vehicle_model || '');
    //             //     setVehicleColor(response.data.vehicle_color || '');
    //             //     setVehicleYear(response.data.vehicle_year ? String(response.data.vehicle_year) : '');
    //             //     setVehiclePlateNumber(response.data.vehicle_plate_number || '');
    //             // }
    //             // Simulate fetch:
    //             await new Promise(r => setTimeout(r, 500));
    //             setVehicleModel('Toyota Corolla');
    //             setVehicleColor('Silver');
    //             setVehicleYear('2018');
    //             setVehiclePlateNumber('GT-1234-20');
    //             setError('');
    //         } catch (err) {
    //             console.error("Fetch Vehicle Info Error:", err.response?.data || err.message);
    //             setError("Could not load vehicle information.");
    //         } finally {
    //             setIsLoading(false);
    //         }
    //     };
    //     fetchVehicleInfo();
    // }, []);

    // For now, using placeholder data as API isn't fully there for this.
    // In a real app, useEffect above would fetch this data.
    useEffect(() => {
        setIsLoading(true);
        // Simulate fetch
        setTimeout(() => {
            setVehicleModel('Toyota Camry (Placeholder)');
            setVehicleColor('Blue (Placeholder)');
            setVehicleYear('2019');
            setVehiclePlateNumber('AS-5678-21 (Placeholder)');
            setIsLoading(false);
        }, 800);
    }, []);


    const handleUpdateVehicle = async () => {
        if (!vehicleModel.trim() && !vehicleColor.trim() && !vehicleYear.trim()) {
            Alert.alert("No Changes", "Please provide information to update.");
            return;
        }
        setIsUpdating(true);
        setError('');
        try {
            const dataToUpdate = {
                vehicle_model: vehicleModel.trim(),
                vehicle_color: vehicleColor.trim(),
                vehicle_year: vehicleYear.trim() ? parseInt(vehicleYear.trim(), 10) : null,
            };
            // const response = await updateMyVehicleInfo(dataToUpdate); // API call
            // if (response.data && response.data.vehicle) {
            //    Alert.alert("Success", "Vehicle information updated!");
            // } else {
            //    setError(response.data?.message || "Failed to update vehicle info.");
            // }
            // Simulate update:
            await new Promise(r => setTimeout(r, 1000));
            Alert.alert("Success (Simulated)", "Vehicle information 'updated'.");

        } catch (err) {
            console.error("Update Vehicle Error:", err.response?.data || err.message);
            setError(err.response?.data?.message || "Error updating vehicle information.");
        } finally {
            setIsUpdating(false);
        }
    };

    if (isLoading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color="#FF6347" /><Text>Loading Vehicle Info...</Text></View>;
    }

    return (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
            <Text style={styles.title}>Manage Your Vehicle</Text>
            {error && <Text style={styles.errorTextGlobal}>{error}</Text>}

            <Text style={styles.label}>Vehicle Plate Number (Cannot be changed here)</Text>
            <CustomInput
                value={vehiclePlateNumber}
                editable={false}
                style={styles.inputField}
            />

            <Text style={styles.label}>Vehicle Model</Text>
            <CustomInput
                placeholder="e.g., Toyota Corolla"
                value={vehicleModel}
                onChangeText={setVehicleModel}
                style={styles.inputField}
            />

            <Text style={styles.label}>Vehicle Color</Text>
            <CustomInput
                placeholder="e.g., Blue"
                value={vehicleColor}
                onChangeText={setVehicleColor}
                style={styles.inputField}
            />

            <Text style={styles.label}>Vehicle Year</Text>
            <CustomInput
                placeholder="e.g., 2019"
                value={vehicleYear}
                onChangeText={setVehicleYear}
                keyboardType="numeric"
                style={styles.inputField}
            />

            <CustomButton
                title={isUpdating ? "Updating..." : "Save Vehicle Changes"}
                onPress={handleUpdateVehicle}
                disabled={isUpdating}
                style={styles.saveButton}
            />

            <Text style={styles.note}>
                To change your vehicle plate number or add a new vehicle, please contact support or visit an admin office.
            </Text>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
        backgroundColor: '#f7f7f7',
    },
    container: {
        padding: 20,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 25,
        textAlign: 'center',
    },
    label: {
        fontSize: 14,
        color: '#555',
        marginBottom: 5,
        marginLeft: 5,
    },
    inputField: {
        marginBottom: 20,
    },
    saveButton: {
        marginTop: 20,
        backgroundColor: '#007bff',
    },
    errorTextGlobal: {
        color: 'red',
        marginBottom: 15,
        fontSize: 14,
        textAlign: 'center',
    },
    note: {
        fontSize: 12,
        color: 'gray',
        textAlign: 'center',
        marginTop: 30,
        paddingHorizontal: 10,
    },
    // Base styles
    buttonBase: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
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
        minHeight: 48,
        justifyContent: 'center',
    },
    inputBase: {
        fontSize: 16,
        color: '#333',
    },
    inputDisabled_Container: {
        backgroundColor: '#e9ecef',
    },
    inputDisabled_Text: {
        color: '#495057',
    }
});

export default VehicleManagementScreen;
