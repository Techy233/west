// VaMiDzoRider/src/screens/RideStatusScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView, TouchableOpacity } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import apiClient from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
    getSocket,
    onRideAccepted, offRideAccepted,
    onRideStatusUpdated, offRideStatusUpdated,
    onRideCancelledByDriver, offRideCancelledByDriver
} from '../services/socketService'; // Import socket listeners

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

            // WebSocket listeners for real-time updates
            const handleRideAccepted = (acceptedRideData) => {
                console.log('RideStatusScreen: ride_accepted event', acceptedRideData);
                if (acceptedRideData.ride_id === rideId) {
                    setRideDetails(prev => ({ ...prev, ...acceptedRideData, status: 'accepted' }));
                    Alert.alert("Ride Update", "Your ride has been accepted by a driver!");
                }
            };
            const handleRideStatusUpdate = (updatedRideData) => {
                console.log('RideStatusScreen: ride_status_updated event', updatedRideData);
                if (updatedRideData.ride_id === rideId) {
                    setRideDetails(prev => ({ ...prev, ...updatedRideData })); // Update with all new details
                    Alert.alert("Ride Update", `Your ride status is now: ${updatedRideData.status.replace('_', ' ')}`);
                }
            };
            const handleRideCancelledByDrv = (data) => {
                console.log('RideStatusScreen: ride_cancelled_by_driver event', data);
                 if (data.rideId === rideId) {
                    setRideDetails(prev => ({ ...prev, status: 'cancelled_driver' }));
                    Alert.alert("Ride Cancelled", data.message || "Your ride was cancelled by the driver.");
                    // Optionally navigate away or show a "find new ride" button
                }
            };

            onRideAccepted(handleRideAccepted);
            onRideStatusUpdated(handleRideStatusUpdate);
            onRideCancelledByDriver(handleRideCancelledByDrv);

            // Remove polling if WebSockets are primary
            // const intervalId = setInterval(() => {
            //     console.log("Polling for ride status update...");
            //     fetchRideStatus();
            // }, 15000);

            return () => {
                // clearInterval(intervalId);
                offRideAccepted(handleRideAccepted);
                offRideStatusUpdated(handleRideStatusUpdate);
                offRideCancelledByDriver(handleRideCancelledByDrv);
            };
        }
    }, [rideId]);


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
    scrollView: { flex: 1, backgroundColor: '#E9F5FF' }, // Consistent light sky blue
    container: { paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 40 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    title: { fontSize: 28, fontWeight: 'bold', color: '#007AFF', marginBottom: 8, textAlign: 'center' }, // Primary blue
    rideIdText: { fontSize: 13, color: '#7f8c8d', textAlign: 'center', marginBottom: 20}, // Asbestos
    map: {
        width: '100%',
        height: 220, // Slightly larger
        borderRadius: 10, // Consistent rounding
        marginBottom: 20, // More space
        borderWidth: 1,
        borderColor: '#CFD8DC', // Blue Grey 100
    },
    statusCard: {
        padding: 18, // More padding
        backgroundColor: '#ffffff',
        borderRadius: 10,
        marginBottom: 20,
        elevation: 2,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width:0, height:1}, shadowOpacity: 0.05, shadowRadius:2,
    },
    statusLabel: { fontSize: 17, fontWeight: '600', color: '#2c3e50'}, // Darker blue/grey
    statusValue: { fontSize: 17, color: '#007AFF', marginLeft: 10, flexShrink: 1, fontWeight: '500' }, // Primary blue
    detailsCard: {
        padding: 18,
        backgroundColor: '#ffffff',
        borderRadius: 10,
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000', shadowOffset: { width:0, height:1}, shadowOpacity: 0.05, shadowRadius:2,
    },
    cardTitle: { fontSize: 19, fontWeight: 'bold', marginBottom: 12, color: '#34495e' }, // Wet asphalt
    detailItem: { fontSize: 16, color: '#34495e', marginBottom: 7, lineHeight: 22 },
    errorTextGlobal: { color: '#D32F2F', marginBottom: 18, fontSize: 15, textAlign: 'center', fontWeight: '500' },
    // Base styles from LoginScreen for consistency
    buttonBase: {
        paddingVertical: 14, // Taller buttons
        paddingHorizontal: 20,
        borderRadius: 25, // Rounded
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 50,
        marginBottom:12, // Space between buttons
        width: '100%', // Full width for action buttons
    },
    buttonTextBase: { color: '#fff', fontSize: 16, fontWeight: '600' },
    buttonDisabled: { backgroundColor: '#B0BEC5' }, // Blue Grey 200
    refreshButton: { backgroundColor: '#1abc9c' }, // Turquoise
    cancelButton: { backgroundColor: '#e74c3c' },  // Alizarin red
    homeButton: { backgroundColor: '#95a5a6', marginTop: 10 } // Asbestos
});

export default RideStatusScreen;
