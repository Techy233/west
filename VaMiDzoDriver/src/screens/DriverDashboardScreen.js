// VaMiDzoDriver/src/screens/DriverDashboardScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, ActivityIndicator, TouchableOpacity, Modal, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

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
import { useAuthDriver } from '../contexts/AuthContext';
import { initSocket, getSocket, disconnectSocket } from '../services/socketService';
import { acceptRide, rejectRide, setDriverAvailability } from '../services/api'; // Added setDriverAvailability

// Default location (Accra, Ghana) - Used if permission denied or error
const ACCRA_DEFAULT_LOCATION = {
    latitude: 5.6037,
    longitude: -0.1870,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
};

// Reusable Button
const CustomButton = ({ title, onPress, style, textStyle, disabled }) => (
    <TouchableOpacity onPress={onPress} style={[styles.buttonBase, style, disabled && styles.buttonDisabled]} disabled={disabled}>
        <Text style={[styles.buttonTextBase, textStyle]}>{title}</Text>
    </TouchableOpacity>
);

const DriverDashboardScreen = ({ navigation }) => {
    const { driverData, signOutDriver } = useAuthDriver();
    const [socket, setSocket] = useState(null);
    const [currentRideRequest, setCurrentRideRequest] = useState(null); // To hold incoming ride request details
    const [isAcceptingOrRejecting, setIsAcceptingOrRejecting] = useState(false);
    const [statusMessage, setStatusMessage] = useState("Listening for ride requests...");
    const [availability, setAvailability] = useState(true); // TODO: Connect this to backend is_available status

    const [currentMapRegion, setCurrentMapRegion] = useState(ACCRA_DEFAULT_LOCATION);
    const [driverMapLocation, setDriverMapLocation] = useState(null); // For driver's marker
    const [locationPermissionStatus, setLocationPermissionStatus] = useState(null);
    const mapRef = useRef(null);

    const driverId = driverData?.userId;

    // --- Location Logic ---
    const requestLocationPermission = async () => {
        let permission;
        if (Platform.OS === 'ios') permission = PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
        else permission = PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
        const status = await request(permission);
        setLocationPermissionStatus(status);
        return status;
    };

    const getCurrentDriverLocation = () => {
        Geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const newRegion = { ...ACCRA_DEFAULT_LOCATION, latitude, longitude };
                setDriverMapLocation({ latitude, longitude });
                setCurrentMapRegion(newRegion);
                if (mapRef.current) mapRef.current.animateToRegion(newRegion, 1000);
                // TODO: Optionally send this location to backend via socketService.emitDriverLocation
            },
            (error) => {
                console.log("Driver Geolocation Error:", error.code, error.message);
                Alert.alert("Location Error", "Could not fetch your current location. Map shows default.");
                setCurrentMapRegion(ACCRA_DEFAULT_LOCATION); // Fallback
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000, showLocationDialog: true }
        );
    };

    useEffect(() => { // For location permission and initial fetch
        const initLocation = async () => {
            const status = await requestLocationPermission();
            if (status === RESULTS.GRANTED || status === 'granted') {
                getCurrentDriverLocation();
            } else {
                Alert.alert("Permission Denied", "Location permission is needed to show your position on the map. Using default map view.");
                setCurrentMapRegion(ACCRA_DEFAULT_LOCATION);
            }
        };
        initLocation();
    }, []);


    // --- Socket Logic ---
    useEffect(() => {
        if (driverId) {
            const s = initSocket(driverId);
            setSocket(s);
            return () => {
                if (s) {
                    s.off('new_ride_request', handleNewRideRequest);
                    disconnectSocket();
                }
                setSocket(null);
            };
        }
    }, [driverId]);


    const handleNewRideRequest = useCallback((rideDetails) => {
        console.log("New ride request received on dashboard:", rideDetails);
        if (availability) { // Only show if driver is available
            setCurrentRideRequest(rideDetails);
            setStatusMessage("New ride request received!");
            // Optionally, vibrate or play a sound
        } else {
            console.log("Driver not available, ignoring ride request notification.");
            // Driver might still be assigned if backend logic doesn't check availability *at notification time*
            // but this UI won't show it if local `availability` is false.
        }
    }, [availability]);


    useEffect(() => {
        const currentSocket = getSocket(); // Get the potentially already initialized socket
        if (currentSocket) {
            // Remove previous listener before adding a new one to prevent duplicates if component re-renders
            currentSocket.off('new_ride_request', handleNewRideRequest);
            currentSocket.on('new_ride_request', handleNewRideRequest);
        }
    }, [socket, handleNewRideRequest]); // Rerun when socket or callback changes


    const handleAcceptRide = async () => {
        if (!currentRideRequest) return;
        setIsAcceptingOrRejecting(true);
        setStatusMessage("Accepting ride...");
        try {
            const response = await acceptRide(currentRideRequest.ride_id);
            if (response.data && response.data.ride) {
                Alert.alert("Ride Accepted!", "Proceed to pickup location.");
                // Navigate to an active ride screen, passing ride details
                navigation.navigate('ActiveRideScreen', { ride: response.data.ride }); // TODO: Create ActiveRideScreen
                setCurrentRideRequest(null); // Clear current request
            } else {
                Alert.alert("Error", response.data?.message || "Could not accept ride.");
            }
        } catch (err) {
            Alert.alert("Error", err.response?.data?.message || "Failed to accept ride.");
            console.error("Accept ride error:", err.response?.data || err.message);
        } finally {
            setIsAcceptingOrRejecting(false);
            setStatusMessage("Listening for ride requests...");
        }
    };

    const handleRejectRide = async () => {
        if (!currentRideRequest) return;
        setIsAcceptingOrRejecting(true);
        setStatusMessage("Rejecting ride...");
        try {
            const response = await rejectRide(currentRideRequest.ride_id);
            if (response.data) {
                Alert.alert("Ride Rejected", response.data.message || "Ride has been rejected.");
                setCurrentRideRequest(null); // Clear current request
            } else {
                 Alert.alert("Error", response.data?.message || "Could not reject ride.");
            }
        } catch (err) {
            Alert.alert("Error", err.response?.data?.message || "Failed to reject ride.");
            console.error("Reject ride error:", err.response?.data || err.message);
        } finally {
            setIsAcceptingOrRejecting(false);
            setStatusMessage("Listening for ride requests...");
        }
    };

    const toggleAvailability = async () => {
        const newAvailability = !availability;
        setStatusMessage(newAvailability ? "Going Online..." : "Going Offline...");
        try {
            await setDriverAvailability(newAvailability);
            setAvailability(newAvailability);
            setStatusMessage(newAvailability ? "You are Online. Listening for ride requests..." : "You are Offline. Go Online to receive requests.");
            if (!newAvailability && currentRideRequest) { // If going offline with a pending request
                setCurrentRideRequest(null); // Clear it from UI, driver won't act on it
            }
        } catch (err) {
            Alert.alert("Error", "Could not update availability status. Please try again.");
            console.error("Set availability error:", err.response?.data || err.message);
            // Revert status message if API call failed
            setStatusMessage(availability ? "You are Online. Listening for ride requests..." : "You are Offline. Go Online to receive requests.");
        }
    };


    if (!driverData) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" />
                <Text>Loading driver data...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Driver Dashboard</Text>
                <CustomButton
                    title={availability ? "Go Offline" : "Go Online"}
                    onPress={toggleAvailability}
                    style={availability ? styles.goOfflineButton : styles.goOnlineButton}
                />
            </View>
            <Text style={styles.driverInfo}>Welcome, {driverData.first_name || driverData.phoneNumber}!</Text>

            {/* Map View Area */}
            <View style={styles.mapContainer}>
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={ACCRA_DEFAULT_LOCATION}
                    region={currentMapRegion}
                    onRegionChangeComplete={setCurrentMapRegion}
                    showsUserLocation={locationPermissionStatus === RESULTS.GRANTED || locationPermissionStatus === 'granted'}
                    showsMyLocationButton={true} // Can enable if desired
                >
                    {driverMapLocation && (
                        <Marker
                            coordinate={driverMapLocation}
                            title="Your Location"
                            description="You are here"
                            pinColor="blue" // Driver's pin
                        />
                    )}
                    {/* TODO: Later, show other drivers or heatmaps if applicable */}
                </MapView>
            </View>

            <Text style={styles.statusMessage}>{statusMessage}</Text>

            {currentRideRequest && availability && (
                <Modal
                    transparent={true}
                    animationType="slide"
                    visible={!!currentRideRequest && availability}
                    onRequestClose={() => {
                        // Android back button, can choose to reject or do nothing
                        // Alert.alert("Ride Request", "You have a pending ride request. Please accept or reject.");
                    }}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.rideRequestCard}>
                            <Text style={styles.cardTitle}>New Ride Request!</Text>

                            {/* Mini-map for ride request */}
                            {currentRideRequest.pickup_latitude && currentRideRequest.dropoff_latitude && (
                                <MapView
                                    provider={PROVIDER_GOOGLE}
                                    style={styles.miniMap}
                                    initialRegion={getRegionForCoordinates([
                                        { latitude: currentRideRequest.pickup_latitude, longitude: currentRideRequest.pickup_longitude },
                                        { latitude: currentRideRequest.dropoff_latitude, longitude: currentRideRequest.dropoff_longitude }
                                    ])}
                                    scrollEnabled={false}
                                    zoomEnabled={false}
                                >
                                    <Marker coordinate={{ latitude: currentRideRequest.pickup_latitude, longitude: currentRideRequest.pickup_longitude }} pinColor="green" title="Pickup"/>
                                    <Marker coordinate={{ latitude: currentRideRequest.dropoff_latitude, longitude: currentRideRequest.dropoff_longitude }} pinColor="red" title="Dropoff"/>
                                </MapView>
                            )}

                            <Text style={styles.detailItem}>From: {currentRideRequest.pickup_address_text || `${currentRideRequest.pickup_latitude.toFixed(4)}, ${currentRideRequest.pickup_longitude.toFixed(4)}`}</Text>
                            <Text style={styles.detailItem}>To: {currentRideRequest.dropoff_address_text || `${currentRideRequest.dropoff_latitude.toFixed(4)}, ${currentRideRequest.dropoff_longitude.toFixed(4)}`}</Text>
                            <Text style={styles.detailItem}>Estimated Fare: GHS {currentRideRequest.estimated_fare}</Text>

                            <View style={styles.buttonRow}>
                                <CustomButton
                                    title="Reject"
                                    onPress={handleRejectRide}
                                    style={[styles.actionButton, styles.rejectButton]}
                                    disabled={isAcceptingOrRejecting}
                                />
                                <CustomButton
                                    title="Accept"
                                    onPress={handleAcceptRide}
                                    style={[styles.actionButton, styles.acceptButton]}
                                    disabled={isAcceptingOrRejecting}
                                />
                            </View>
                            {isAcceptingOrRejecting && <ActivityIndicator style={{marginTop:10}} size="small" />}
                        </View>
                    </View>
                </Modal>
            )}

            {!currentRideRequest && availability && (
                <View style={styles.noRequestView}>
                    <ActivityIndicator size="small" color="#007bff"/>
                    <Text style={styles.waitingText}>Waiting for new ride requests...</Text>
                </View>
            )}

            {/* Navigation to other driver screens */}
            <CustomButton title="View Ride History (TODO)" onPress={() => Alert.alert("TODO", "Ride History Screen")} style={styles.navButton} />
            <CustomButton title="Manage Vehicle" onPress={() => navigation.navigate('VehicleManagement')} style={styles.navButton} />
            <CustomButton title="Upload Documents" onPress={() => navigation.navigate('DocumentUpload')} style={styles.navButton} />
            <CustomButton title="My Profile (TODO)" onPress={() => Alert.alert("TODO", "Profile Screen")} style={styles.navButton} />

            <CustomButton
                title="Logout"
                onPress={async () => {
                    await signOutDriver();
                    // AppNavigator will handle navigation to AuthStack
                }}
                style={styles.logoutButton}
            />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    scrollView: { flex: 1, backgroundColor: '#f4f6f8' }, // Lighter background
    container: { flexGrow: 1, padding: 15, alignItems: 'stretch' }, // alignItems: 'stretch' for full-width buttons, flexGrow for ScrollView
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center'},
    header: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        paddingHorizontal: 5,
    },
    title: { fontSize: 26, fontWeight: 'bold', color: '#2c3e50' }, // Darker blue/grey
    driverInfo: { fontSize: 17, color: '#34495e', marginBottom: 8, alignSelf: 'flex-start' }, // Slightly darker
    mapContainer: {
        width: '100%',
        height: 200, // Adjust as needed, or use flex
        backgroundColor: '#e0e0e0', // Placeholder background
        marginBottom: 10,
        borderRadius: 10, // Consistent border radius
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    statusMessage: { fontSize: 15, color: '#7f8c8d', marginVertical: 12, fontStyle: 'italic', textAlign: 'center' },
    goOnlineButton: { backgroundColor: '#2ecc71', paddingVertical: 10, paddingHorizontal:15, minWidth: 110, borderRadius: 25}, // Emerald green, more rounded
    goOfflineButton: { backgroundColor: '#f39c12', paddingVertical: 10, paddingHorizontal:15, minWidth: 110, borderRadius: 25}, // Orange, more rounded
    miniMap: {
        width: '100%',
        height: 150,
        borderRadius: 10, // Consistent border radius
        marginBottom: 15, // More space
        borderWidth: 1,
        borderColor: '#eee',
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding:20},
    rideRequestCard: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#fff',
        borderRadius: 12, // Slightly more rounded
        padding: 25,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    cardTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#333' },
    detailItem: { fontSize: 16, marginBottom: 10, color: '#444', lineHeight: 22 },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25 },
    actionButton: { flex: 1, marginHorizontal: 8, paddingVertical: 14, borderRadius: 25 },
    acceptButton: { backgroundColor: '#2ecc71' },
    rejectButton: { backgroundColor: '#e74c3c' },

    noRequestView: { marginTop: 40, alignItems: 'center', opacity: 0.8},
    waitingText: {fontSize: 17, color: '#3498db', marginTop: 12},

    navButton: { backgroundColor: '#95a5a6', width: '100%', marginTop: 12, borderRadius: 25, paddingVertical: 14},
    logoutButton: { backgroundColor: '#e74c3c', width: '100%', marginTop: 30, borderRadius: 25, paddingVertical: 14 },
    // Base styles from CustomButton
    buttonBase: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
    buttonTextBase: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    buttonDisabled: { backgroundColor: '#bdc3c7' }, // Silver for disabled
});

export default DriverDashboardScreen;
