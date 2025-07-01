// VaMiDzoRider/src/screens/RideStatusScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView, TouchableOpacity } from 'react-native'; // Added ScrollView, TouchableOpacity
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import apiClient from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Reusable Button
const CustomButton = ({ title, onPress, style, textStyle, disabled }) => (
    <TouchableOpacity onPress={onPress} style={[styles.buttonBase, style, disabled && styles.buttonDisabled]} disabled={disabled}>
        <Text style={[styles.buttonTextBase, textStyle]}>{title}</Text>
    </TouchableOpacity>
);

// Helper to calculate map region from markers
const getRegionForCoordinates = (points) => {
    if (!points || points.length === 0) return null;

    let minX, maxX, minY, maxY;

    points.forEach(point => {
        minX = (minX === undefined || point.latitude < minX) ? point.latitude : minX;
        maxX = (maxX === undefined || point.latitude > maxX) ? point.latitude : maxX;
        minY = (minY === undefined || point.longitude < minY) ? point.longitude : minY;
        maxY = (maxY === undefined || point.longitude > maxY) ? point.longitude : maxY;
    });

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const deltaX = (maxX - minX) * 1.5; // Add some padding
    const deltaY = (maxY - minY) * 1.5; // Add some padding

    return {
        latitude: midX,
        longitude: midY,
        latitudeDelta: Math.max(0.02, deltaX), // Min delta to avoid too zoomed in
        longitudeDelta: Math.max(0.02, deltaY),
    };
};


const RideStatusScreen = ({ route, navigation }) => {
    const { rideId } = route.params;
    const { userToken } = useAuth();
    const [rideDetails, setRideDetails] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const mapRef = useRef(null);
    const [mapRegion, setMapRegion] = useState(null);

    useEffect(() => { // Effect to set map region when rideDetails are available
        if (rideDetails?.pickup_latitude && rideDetails?.dropoff_latitude) {
            const points = [
                { latitude: rideDetails.pickup_latitude, longitude: rideDetails.pickup_longitude },
                { latitude: rideDetails.dropoff_latitude, longitude: rideDetails.dropoff_longitude },
            ];
            if (rideDetails.driver?.current_latitude && rideDetails.driver?.current_longitude) { // If driver location is available
                points.push({ latitude: rideDetails.driver.current_latitude, longitude: rideDetails.driver.current_longitude });
            }
            const region = getRegionForCoordinates(points);
            if (region) {
                setMapRegion(region);
            }
        }
    }, [rideDetails]);


    const fetchRideStatus = async () => {
        if (!rideId) {
            setError("No ride ID provided.");
            setIsLoading(false);
            return;
        }
        // setError(''); // Clear previous error before fetching
        // setIsLoading(true); // isLoading is managed per fetch, not globally for screen once loaded
        setError(''); // Clear previous error for this fetch attempt

        try {
            const response = await apiClient.get(`/rides/${rideId}`);
            if (response.data) {
                setRideDetails(response.data);
            } else {
                setError("Could not retrieve ride details.");
            }
        } catch (err) {
            console.error("Fetch ride status error:", err.response?.data || err.message);
            setError(err.response?.data?.message || "Could not fetch ride status.");
            if (err.response?.status === 401 || err.response?.status === 403){
                // Handle auth issues, maybe navigate to login
                Alert.alert("Authentication Error", "Please login again to view ride status.", [{text: "OK"}]);
                navigation.navigate("Login");
            }
        } finally {
            setIsLoading(false); // Set loading to false after each fetch attempt
        }
    };

    useEffect(() => {
        if (rideId) {
            fetchRideStatus(); // Initial fetch

            // Set up polling
            const intervalId = setInterval(() => {
                console.log("Polling for ride status update...");
                // Avoid setting global isLoading to true for background polls,
                // unless you want a global loading indicator.
                // For now, fetchRideStatus handles its own loading state for the content.
                fetchRideStatus();
            }, 15000); // Poll every 15 seconds

            return () => clearInterval(intervalId); // Cleanup interval on unmount
        }
    }, [rideId]); // Dependency array includes rideId


    const handleCancelRide = async () => {
        Alert.alert(
            "Cancel Ride",
            "Are you sure you want to cancel this ride?",
            [
                { text: "No", style: "cancel" },
                {
                    text: "Yes, Cancel",
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            const response = await apiClient.post(`/rides/${rideId}/cancel-rider`, { reason: "Cancelled by user from app" });
                            if (response.data) { // Check if response.data exists
                                Alert.alert("Ride Cancelled", response.data.message || "Your ride has been cancelled.");
                                navigation.goBack(); // Or navigate to Home
                            } else {
                                Alert.alert("Error", "Could not cancel ride properly. Response data missing.");
                                setIsLoading(false);
                            }
                        } catch (err) {
                            Alert.alert("Error", "Could not cancel ride. " + (err.response?.data?.message || err.message || "Unknown error"));
                            setIsLoading(false); // Ensure loading is false on error
                        }
                    }
                }
            ]
        );
    };


    if (isLoading && !rideDetails) { // Show loading only on initial load
        return <View style={styles.centered}><ActivityIndicator size="large" color="#FF6347" /><Text>Loading Ride Status...</Text></View>;
    }

    if (error && !rideDetails) {
        return <View style={styles.centered}><Text style={styles.errorTextGlobal}>{error}</Text></View>;
    }

    if (!rideDetails) {
        return <View style={styles.centered}><Text>No ride details available.</Text></View>;
    }

    // Determine user-friendly status message
    let statusMessage = "Processing your request...";
    switch (rideDetails.status) {
        case 'requested': statusMessage = "Searching for a driver..."; break;
        case 'accepted': statusMessage = `Driver ${rideDetails.driver?.first_name || 'Kofi'} is on the way!`; break;
        case 'driver_arrived': statusMessage = `Driver ${rideDetails.driver?.first_name || 'Kofi'} has arrived at pickup.`; break;
        case 'ongoing': statusMessage = "Your ride is in progress."; break;
        case 'completed': statusMessage = "Ride completed. Thank you!"; break;
        case 'cancelled_rider': statusMessage = "You cancelled this ride."; break;
        case 'cancelled_driver': statusMessage = "Driver cancelled this ride."; break;
        default: statusMessage = `Status: ${rideDetails.status}`;
    }
    const canCancel = ['requested', 'accepted'].includes(rideDetails.status);


    return (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
            <Text style={styles.title}>Ride Status</Text>
            <Text style={styles.rideIdText}>Ride ID: {rideDetails.ride_id.substring(0,13)}...</Text>

            {mapRegion && (
                 <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={mapRegion} // Set initial region to fit markers
                    // region={mapRegion} // Can be controlled if needed for future interactions
                    showsUserLocation={false} // Rider's own location not primary here
                >
                    <Marker
                        coordinate={{ latitude: rideDetails.pickup_latitude, longitude: rideDetails.pickup_longitude }}
                        title="Pickup Location"
                        description={rideDetails.pickup_address_text}
                        pinColor="green"
                    />
                    <Marker
                        coordinate={{ latitude: rideDetails.dropoff_latitude, longitude: rideDetails.dropoff_longitude }}
                        title="Dropoff Location"
                        description={rideDetails.dropoff_address_text}
                        pinColor="red"
                    />
                    {/* TODO: Add Driver's marker when location is available in rideDetails.driver */}
                    {/* {rideDetails.driver?.current_latitude && rideDetails.driver?.current_longitude && (
                        <Marker
                            coordinate={{ latitude: rideDetails.driver.current_latitude, longitude: rideDetails.driver.current_longitude }}
                            title={`Driver ${rideDetails.driver.first_name || ''}`}
                            pinColor="blue"
                        />
                    )} */}
                </MapView>
            )}

            <View style={styles.statusCard}>
                <Text style={styles.statusLabel}>Current Status:</Text>
                <Text style={styles.statusValue}>{statusMessage}</Text>
                {isLoading && <ActivityIndicator size="small" color="#007bff" style={{marginLeft: 10}}/>}
            </View>

            <View style={styles.detailsCard}>
                <Text style={styles.cardTitle}>Trip Details</Text>
                <Text style={styles.detailItem}>From: {rideDetails.pickup_address_text}</Text>
                <Text style={styles.detailItem}>To: {rideDetails.dropoff_address_text}</Text>
                <Text style={styles.detailItem}>Estimated Fare: GHS {rideDetails.estimated_fare}</Text>
            </View>

            {rideDetails.driver && (rideDetails.status === 'accepted' || rideDetails.status === 'driver_arrived' || rideDetails.status === 'ongoing') && (
                <View style={styles.detailsCard}>
                    <Text style={styles.cardTitle}>Driver Details</Text>
                    <Text style={styles.detailItem}>Driver: {rideDetails.driver.first_name}</Text>
                    <Text style={styles.detailItem}>Vehicle: {rideDetails.driver.vehicle_model}</Text>
                    <Text style={styles.detailItem}>Plate: {rideDetails.driver.vehicle_plate_number}</Text>
                    {/* TODO: Add driver ETA, current location on map (future) */}
                </View>
            )}

            <CustomButton title="Refresh Status" onPress={fetchRideStatus} style={styles.refreshButton} disabled={isLoading} />

            {canCancel && (
                <CustomButton
                    title="Cancel Ride"
                    onPress={handleCancelRide}
                    style={styles.cancelButton}
                    disabled={isLoading}
                />
            )}
             <CustomButton
                title="Back to Home"
                onPress={() => navigation.navigate('Home')}
                style={styles.homeButton}
            />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    scrollView: { flex: 1, backgroundColor: '#f7f7f7' },
    container: { padding: 20, paddingBottom: 40 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 5, textAlign: 'center' },
    rideIdText: { fontSize: 12, color: 'gray', textAlign: 'center', marginBottom: 10}, // Reduced margin
    map: {
        width: '100%',
        height: 200, // Adjust as needed
        borderRadius: 8,
        marginBottom: 15,
    },
    statusCard: { padding: 15, backgroundColor: '#fff', borderRadius: 8, marginBottom: 20, elevation: 2, flexDirection: 'row', alignItems: 'center' },
    statusLabel: { fontSize: 16, fontWeight: '500', color: '#333'},
    statusValue: { fontSize: 16, color: '#007bff', marginLeft: 8, flexShrink: 1 },
    detailsCard: { padding: 15, backgroundColor: '#fff', borderRadius: 8, marginBottom: 20, elevation: 2 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
    detailItem: { fontSize: 15, color: '#444', marginBottom: 5 },
    errorTextGlobal: { color: 'red', marginBottom: 15, fontSize: 14, textAlign: 'center' },
    // Base styles
    buttonBase: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 48, marginBottom:10 },
    buttonTextBase: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    buttonDisabled: { backgroundColor: '#ccc' },
    refreshButton: { backgroundColor: '#17a2b8' }, // Teal
    cancelButton: { backgroundColor: '#dc3545' },  // Red
    homeButton: { backgroundColor: 'gray' }
});
// import { TouchableOpacity } from 'react-native'; // Already imported at the top

export default RideStatusScreen;
