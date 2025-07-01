// VaMiDzoDriver/src/screens/ActiveRideScreen.js
import React, { useState, useEffect, useRef } from 'react'; // Added useRef
import { View, Text, StyleSheet, Alert, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'; // Added MapView, Marker
import { useAuthDriver } from '../contexts/AuthContext';
import { updateRideStatusByDriver } from '../services/api';
// import { getRideDetails } from '../services/api'; // For fetching updates if needed

// Helper to calculate map region from markers (can be moved to a utils file)
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
    const deltaX = (maxX - minX) * 1.5;
    const deltaY = (maxY - minY) * 1.5;
    return { latitude: midX, longitude: midY, latitudeDelta: Math.max(0.02, deltaX), longitudeDelta: Math.max(0.02, deltaY) };
};


// Reusable Button
const CustomButton = ({ title, onPress, style, textStyle, disabled }) => (
    <TouchableOpacity onPress={onPress} style={[styles.buttonBase, style, disabled && styles.buttonDisabled]} disabled={disabled}>
        <Text style={[styles.buttonTextBase, textStyle]}>{title}</Text>
    </TouchableOpacity>
);

const ActiveRideScreen = ({ route, navigation }) => {
    const { ride: initialRide } = route.params; // Ride object passed from dashboard
    const { driverData } = useAuthDriver();
    const [currentRide, setCurrentRide] = useState(initialRide);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const mapRef = useRef(null);
    const [mapRegion, setMapRegion] = useState(null);

    useEffect(() => {
        setCurrentRide(initialRide);
        if (initialRide?.pickup_latitude && initialRide?.dropoff_latitude) {
            const points = [
                { latitude: initialRide.pickup_latitude, longitude: initialRide.pickup_longitude },
                { latitude: initialRide.dropoff_latitude, longitude: initialRide.dropoff_longitude },
            ];
            // TODO: Add driver's current location marker if available and needed for context on this screen
            const region = getRegionForCoordinates(points);
            if (region) {
                setMapRegion(region);
            }
        }
        // Optionally, set up polling or WebSocket listener here for real-time updates to *this specific ride*
    }, [initialRide]);


    const handleUpdateStatus = async (action) => {
        setIsLoading(true);
        setError('');
        try {
            const response = await updateRideStatusByDriver(currentRide.ride_id, action);
            if (response.data && response.data.ride) {
                setCurrentRide(response.data.ride); // Update local ride state
                Alert.alert("Status Updated", response.data.message || `Ride status changed to ${response.data.ride.status}.`);
                if (response.data.ride.status === 'completed' || response.data.ride.status.startsWith('cancelled')) {
                    // Navigate back to dashboard or a "ride complete" screen after a delay
                    setTimeout(() => navigation.navigate('DriverDashboard'), 2000);
                }
            } else {
                Alert.alert("Error", response.data?.message || "Could not update ride status.");
            }
        } catch (err) {
            Alert.alert("Error", err.response?.data?.message || "Failed to update ride status.");
            console.error(`Update ride status to ${action} error:`, err.response?.data || err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!currentRide) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" />
                <Text>Loading ride data...</Text>
            </View>
        );
    }

    // Determine which buttons to show based on current ride status
    const canMarkArrived = currentRide.status === 'accepted';
    const canStartTrip = currentRide.status === 'driver_arrived' || currentRide.status === 'accepted'; // Allow starting if 'arrived' was missed
    const canCompleteTrip = currentRide.status === 'ongoing';
    const isRideActive = ['accepted', 'driver_arrived', 'ongoing'].includes(currentRide.status);


    return (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
            <Text style={styles.title}>Active Ride</Text>
            <Text style={styles.rideIdText}>Ride ID: {currentRide.ride_id.substring(0,13)}...</Text>

            {error && <Text style={styles.errorTextGlobal}>{error}</Text>}

            {mapRegion && (
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={mapRegion}
                    scrollEnabled={true} // Allow driver to pan/zoom if needed
                >
                    <Marker
                        coordinate={{ latitude: currentRide.pickup_latitude, longitude: currentRide.pickup_longitude }}
                        title="Pickup"
                        description={currentRide.pickup_address_text}
                        pinColor="green"
                    />
                    <Marker
                        coordinate={{ latitude: currentRide.dropoff_latitude, longitude: currentRide.dropoff_longitude }}
                        title="Dropoff"
                        description={currentRide.dropoff_address_text}
                        pinColor="red"
                    />
                    {/* TODO: Show driver's current location marker, updating live (future step) */}
                </MapView>
            )}

            <View style={styles.detailsCard}>
                <Text style={styles.cardTitle}>Trip Details</Text>
                <Text style={styles.detailItem}>Status: <Text style={styles.statusText}>{currentRide.status.replace('_', ' ').toUpperCase()}</Text></Text>
                <Text style={styles.detailItem}>From: {currentRide.pickup_address_text || `${currentRide.pickup_latitude.toFixed(4)}, ${currentRide.pickup_longitude.toFixed(4)}`}</Text>
                <Text style={styles.detailItem}>To: {currentRide.dropoff_address_text || `${currentRide.dropoff_latitude.toFixed(4)}, ${currentRide.dropoff_longitude.toFixed(4)}`}</Text>
                <Text style={styles.detailItem}>Estimated Fare: GHS {currentRide.estimated_fare}</Text>
            </View>

            {isRideActive && (
                <View style={styles.actionsCard}>
                    <Text style={styles.cardTitle}>Manage Ride</Text>
                    {canMarkArrived && (
                        <CustomButton
                            title="I've Arrived at Pickup"
                            onPress={() => handleUpdateStatus('driver_arrived')}
                            style={styles.actionButton}
                            disabled={isLoading}
                        />
                    )}
                    {canStartTrip && (
                         <CustomButton
                            title="Start Trip"
                            onPress={() => handleUpdateStatus('start_trip')}
                            style={[styles.actionButton, styles.startButton]}
                            disabled={isLoading}
                        />
                    )}
                    {canCompleteTrip && (
                        <CustomButton
                            title="End Trip & Complete"
                            onPress={() => handleUpdateStatus('complete_trip')}
                            style={[styles.actionButton, styles.completeButton]}
                            disabled={isLoading}
                        />
                    )}
                </View>
            )}

            {!isRideActive && currentRide.status !== 'requested' && ( // requested is handled by dashboard
                 <View style={styles.detailsCard}>
                    <Text style={styles.cardTitle}>Ride Concluded</Text>
                    <Text style={styles.finalStatusText}>
                        This ride is {currentRide.status.replace('_', ' ').toLowerCase()}.
                    </Text>
                    <CustomButton title="Back to Dashboard" onPress={() => navigation.navigate('DriverDashboard')} style={styles.navButton}/>
                </View>
            )}

            {isLoading && <ActivityIndicator size="large" color="#007bff" style={{marginTop: 20}}/>}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    scrollView: { flex: 1, backgroundColor: '#f4f6f8' }, // Lighter background
    container: { padding: 20, paddingBottom: 40 }, // More padding
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center'},
    title: { fontSize: 26, fontWeight: 'bold', color: '#2c3e50', marginBottom: 8, textAlign: 'center' }, // Darker blue/grey
    rideIdText: { fontSize: 13, color: '#7f8c8d', textAlign: 'center', marginBottom: 20}, // Slightly larger, more margin
    map: {
        width: '100%',
        height: 220, // Slightly larger
        borderRadius: 10, // Consistent radius
        marginBottom: 20, // More space
        borderWidth: 1,
        borderColor: '#ddd',
    },
    errorTextGlobal: { color: '#e74c3c', marginBottom: 15, fontSize: 15, textAlign: 'center' }, // Alizarin red

    detailsCard: { backgroundColor: '#ffffff', borderRadius: 10, padding: 20, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width:0, height:2}, shadowOpacity: 0.1, shadowRadius:4 },
    actionsCard: { backgroundColor: '#ffffff', borderRadius: 10, padding: 20, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width:0, height:2}, shadowOpacity: 0.1, shadowRadius:4 },
    cardTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, color: '#34495e' }, // Wet asphalt
    detailItem: { fontSize: 16, marginBottom: 8, color: '#34495e', lineHeight: 22 },
    statusText: { fontWeight: 'bold', color: '#3498db'}, // Peter river blue
    finalStatusText: { fontSize: 17, textAlign: 'center', marginVertical: 20, color: '#2c3e50'},

    actionButton: { marginBottom: 15, backgroundColor: '#3498db', borderRadius: 25, paddingVertical: 14 },
    startButton: { backgroundColor: '#2ecc71'}, // Emerald green
    completeButton: { backgroundColor: '#1abc9c'}, // Turquoise
    navButton: { backgroundColor: '#95a5a6', marginTop:15, borderRadius: 25, paddingVertical: 14}, // Asbestos

    // Base styles from CustomButton
    buttonBase: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
    buttonTextBase: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    buttonDisabled: { backgroundColor: '#bdc3c7' }, // Silver
});

export default ActiveRideScreen;
