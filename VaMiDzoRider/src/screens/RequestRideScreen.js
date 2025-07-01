// VaMiDzoRider/src/screens/RequestRideScreen.js
import React, { useState } from 'react';
import {
    View, Text, TextInput, StyleSheet, Alert, ScrollView, ActivityIndicator, TouchableOpacity
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api';

// Reusable components (can be moved)
const CustomButton = ({ title, onPress, style, textStyle, disabled }) => (
    <TouchableOpacity onPress={onPress} style={[styles.buttonBase, style, disabled && styles.buttonDisabled]} disabled={disabled}>
        <Text style={[styles.buttonTextBase, textStyle]}>{title}</Text>
    </TouchableOpacity>
);
const CustomInput = ({ value, onChangeText, placeholder, style, inputStyle, keyboardType, multiline, numberOfLines }) => (
    <View style={[styles.inputContainerBase, style, multiline && styles.inputContainerMultiline]}>
        <TextInput
            style={[styles.inputBase, inputStyle, multiline && styles.inputMultiline]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#888"
            keyboardType={keyboardType || 'default'}
            multiline={multiline}
            numberOfLines={numberOfLines}
        />
    </View>
);

const RequestRideScreen = ({ route, navigation }) => { // Added route prop
    const { userToken } = useAuth();

    // Initialize from route params if available (from MapScreen)
    const initialPickup = route.params?.pickup;
    const initialDropoff = route.params?.dropoff;

    const [pickupLat, setPickupLat] = useState(initialPickup?.latitude?.toString() || '');
    const [pickupLon, setPickupLon] = useState(initialPickup?.longitude?.toString() || '');
    const [pickupAddress, setPickupAddress] = useState(route.params?.pickupAddressText || (initialPickup ? `Lat: ${initialPickup.latitude.toFixed(4)}, Lon: ${initialPickup.longitude.toFixed(4)}` : ''));

    const [dropoffLat, setDropoffLat] = useState(initialDropoff?.latitude?.toString() || '');
    const [dropoffLon, setDropoffLon] = useState(initialDropoff?.longitude?.toString() || '');
    const [dropoffAddress, setDropoffAddress] = useState(route.params?.dropoffAddressText || (initialDropoff ? `Lat: ${initialDropoff.latitude.toFixed(4)}, Lon: ${initialDropoff.longitude.toFixed(4)}` : ''));

    const [estimatedFare, setEstimatedFare] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Function to calculate Haversine distance
    function haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Recalculate fare when coordinates change
    useEffect(() => {
        if (pickupLat && pickupLon && dropoffLat && dropoffLon) {
            const pLat = parseFloat(pickupLat);
            const pLon = parseFloat(pickupLon);
            const dLat = parseFloat(dropoffLat);
            const dLon = parseFloat(dropoffLon);

            if (!isNaN(pLat) && !isNaN(pLon) && !isNaN(dLat) && !isNaN(dLon)) {
                const distance = haversineDistance(pLat, pLon, dLat, dLon);
                const baseFare = 5.00;
                const ratePerKm = 1.50;
                const fare = baseFare + (distance * ratePerKm);
                setEstimatedFare(fare.toFixed(2));
            } else {
                setEstimatedFare(null);
            }
        } else {
            setEstimatedFare(null);
        }
    }, [pickupLat, pickupLon, dropoffLat, dropoffLon]);


    const handleRequestRide = async () => {
        if (!pickupLat || !pickupLon || !dropoffLat || !dropoffLon) {
            Alert.alert("Missing Coordinates", "Please fill in all latitude and longitude fields.");
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const rideDetails = {
                pickup_latitude: parseFloat(pickupLat),
                pickup_longitude: parseFloat(pickupLon),
                pickup_address_text: pickupAddress || `Lat:${pickupLat}, Lon:${pickupLon}`,
                dropoff_latitude: parseFloat(dropoffLat),
                dropoff_longitude: parseFloat(dropoffLon),
                dropoff_address_text: dropoffAddress || `Lat:${dropoffLat}, Lon:${dropoffLon}`,
            };

            // Using apiClient directly as per its setup in api.js
            const response = await apiClient.post('/rides', rideDetails);
            // const response = await apiRequestRide(rideDetails); // if using named export

            if (response.data && response.data.ride) {
                Alert.alert("Ride Requested!", response.data.message || "Your ride is being processed.");
                // Navigate to a "RideStatusScreen" or "WaitingForDriverScreen"
                // For now, maybe back to Home or a dedicated status screen.
                navigation.navigate('RideStatus', { rideId: response.data.ride.ride_id });
            } else {
                setError(response.data?.message || "Failed to request ride.");
            }
        } catch (err) {
            console.error("Request ride error:", err.response?.data || err.message);
            setError(err.response?.data?.message || "An error occurred while requesting your ride.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
            <Text style={styles.title}>Request a Ride</Text>
            {error && <Text style={styles.errorTextGlobal}>{error}</Text>}

            <Text style={styles.label}>Pickup Location</Text>
            <CustomInput
                placeholder="Pickup Latitude"
                value={pickupLat}
                onChangeText={setPickupLat} // Fare recalculates via useEffect
                keyboardType="numeric" style={styles.inputField}
                editable={!initialPickup} // Not editable if passed from map
            />
            <CustomInput
                placeholder="Pickup Longitude"
                value={pickupLon}
                onChangeText={setPickupLon} // Fare recalculates via useEffect
                keyboardType="numeric" style={styles.inputField}
                editable={!initialPickup}
            />
            <CustomInput
                placeholder="Pickup Address (Optional)"
                value={pickupAddress}
                onChangeText={setPickupAddress}
                style={styles.inputField} multiline numberOfLines={2}
                editable={!initialPickup} // Or allow address editing even if coords are set
            />

            <Text style={styles.label}>Dropoff Location</Text>
            <CustomInput
                placeholder="Dropoff Latitude"
                value={dropoffLat}
                onChangeText={setDropoffLat} // Fare recalculates via useEffect
                keyboardType="numeric" style={styles.inputField}
                editable={!initialDropoff}
            />
            <CustomInput
                placeholder="Dropoff Longitude"
                value={dropoffLon}
                onChangeText={setDropoffLon} // Fare recalculates via useEffect
                keyboardType="numeric" style={styles.inputField}
                editable={!initialDropoff}
            />
            <CustomInput
                placeholder="Dropoff Address (Optional)"
                value={dropoffAddress}
                onChangeText={setDropoffAddress}
                style={styles.inputField} multiline numberOfLines={2}
                editable={!initialDropoff}
            />
             {initialPickup && initialDropoff && (
                <Text style={styles.infoText}>Locations selected from map. Edit address fields if needed.</Text>
            )}

            {estimatedFare && (
                <Text style={styles.fareEstimate}>
                    Estimated Fare: GHS {estimatedFare}
                </Text>
            )}

            <CustomButton
                title={isLoading ? "Requesting..." : "Request Ride Now"}
                onPress={handleRequestRide}
                disabled={isLoading || !pickupLat || !pickupLon || !dropoffLat || !dropoffLon}
                style={styles.requestButton}
            />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    scrollView: { flex: 1, backgroundColor: '#f7f7f7' },
    container: { padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 20, textAlign: 'center' },
    label: { fontSize: 14, color: '#555', marginBottom: 5, marginLeft: 5, fontWeight: '500' },
    inputField: { marginBottom: 15 },
    requestButton: { marginTop: 20, backgroundColor: '#FF6347' }, // Tomato color
    errorTextGlobal: { color: 'red', marginBottom: 15, fontSize: 14, textAlign: 'center' },
    fareEstimate: { fontSize: 18, fontWeight: 'bold', color: 'green', textAlign: 'center', marginVertical: 15 },
    infoText: { fontSize: 12, fontStyle: 'italic', color: 'gray', textAlign: 'center', marginBottom: 10 },
    // Base styles
    buttonBase: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
    buttonTextBase: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    buttonDisabled: { backgroundColor: '#ccc' },
    inputContainerBase: { width: '100%', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ddd', paddingHorizontal: 15, minHeight: 48, justifyContent: 'center' },
    inputBase: { fontSize: 16, color: '#333' },
    inputContainerMultiline: { minHeight: 80, alignItems: 'flex-start', paddingTop: 10 },
    inputMultiline: { textAlignVertical: 'top'},
});

export default RequestRideScreen;
