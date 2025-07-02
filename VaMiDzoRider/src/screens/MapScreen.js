// VaMiDzoRider/src/screens/MapScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react'; // Added useCallback
import { View, StyleSheet, Text, Alert, Platform, TouchableOpacity } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { getNearbyDrivers } from '../services/api'; // Import the new API function

// Default location (Accra, Ghana) - Used if permission denied or error
const ACCRA_DEFAULT_LOCATION = {
    latitude: 5.6037,    // Accra
    longitude: -0.1870,
    latitudeDelta: 0.0922, // Zoom level
    longitudeDelta: 0.0421, // Zoom level
};

// IMPORTANT: Replace with your actual Google Maps API Key for Places API
const GOOGLE_PLACES_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY_FOR_PLACES';

const MapScreen = ({ navigation }) => {
    const [currentRegion, setCurrentRegion] = useState(ACCRA_DEFAULT_LOCATION);
    const [userLocation, setUserLocation] = useState(null);
    const [locationPermissionStatus, setLocationPermissionStatus] = useState(null);
    const mapRef = useRef(null); // Ref for MapView

    const [pickupLocation, setPickupLocation] = useState(null);
    const [dropoffLocation, setDropoffLocation] = useState(null);
    const [selectingFor, setSelectingFor] = useState('pickup');
    const [nearbyDrivers, setNearbyDrivers] = useState([]);
    const [isFetchingDrivers, setIsFetchingDrivers] = useState(false);
    const debounceTimeout = useRef(null); // For debouncing map region changes

    // Request location permission
    const requestLocationPermission = async () => {
        let permission;
        if (Platform.OS === 'ios') {
            permission = PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
        } else { // Android
            permission = PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
        }

        const status = await request(permission);
        setLocationPermissionStatus(status);
        return status;
    };

    // Get current location
    const getCurrentLocation = () => {
        Geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const newRegion = { ...ACCRA_DEFAULT_LOCATION, latitude, longitude };
                setUserLocation({ latitude, longitude });
                setCurrentRegion(newRegion);
                if (mapRef.current) {
                    mapRef.current.animateToRegion(newRegion, 1000);
                }
            },
            (error) => {
                console.log("Geolocation Error:", error.code, error.message);
                Alert.alert("Location Error", "Could not fetch your current location. Showing default.");
                setCurrentRegion(ACCRA_DEFAULT_LOCATION); // Fallback to default
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000, showLocationDialog: true }
        );
    };

    useEffect(() => {
        const init = async () => {
            const status = await requestLocationPermission();
            if (status === RESULTS.GRANTED || status === 'granted') {
                getCurrentLocation();
            } else {
                Alert.alert("Permission Denied", "Location permission is required to show your current location. Using default location.");
                setCurrentRegion(ACCRA_DEFAULT_LOCATION);
            }
        };
        init();
    }, []); // Empty dependency array, runs once on mount

    // Fetch Nearby Drivers
    const fetchNearbyDrivers = useCallback(async (region) => {
        if (!region || isFetchingDrivers) return;
        setIsFetchingDrivers(true);
        console.log(`Fetching drivers around Lat: ${region.latitude}, Lon: ${region.longitude}`);
        try {
            const response = await getNearbyDrivers(region.latitude, region.longitude, 5); // 5km radius
            if (response.data) {
                setNearbyDrivers(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch nearby drivers:", error.response?.data || error.message);
            // Alert.alert("Error", "Could not fetch nearby drivers.");
        } finally {
            setIsFetchingDrivers(false);
        }
    }, [isFetchingDrivers]); // Dependency on isFetchingDrivers to prevent re-triggering while one is in progress

    // Effect to fetch drivers when user location is first determined or currentRegion changes significantly
    useEffect(() => {
        if (userLocation) { // Fetch when user location is available
            fetchNearbyDrivers(currentRegion);
        }
        // Could also fetch when currentRegion (map view) changes, possibly debounced
    }, [userLocation, fetchNearbyDrivers]); // currentRegion dependency removed to avoid too many calls, will use onRegionChangeComplete with debounce


    const handleMapPress = (event) => {
        const { coordinate } = event.nativeEvent;
        if (selectingFor === 'pickup') {
            setPickupLocation(coordinate);
            // Alert.alert("Pickup Set", `Lat: ${coordinate.latitude.toFixed(4)}, Lon: ${coordinate.longitude.toFixed(4)}`);
        } else {
            setDropoffLocation(coordinate);
            // Alert.alert("Dropoff Set", `Lat: ${coordinate.latitude.toFixed(4)}, Lon: ${coordinate.longitude.toFixed(4)}`);
        }
    };

    const onPlaceSelected = (details, data) => {
        if (!details?.geometry?.location) {
            console.warn("GooglePlacesAutocomplete: No details.geometry.location found");
            return;
        }
        const point = {
            latitude: details.geometry.location.lat,
            longitude: details.geometry.location.lng,
        };
        const newRegion = {
            ...ACCRA_DEFAULT_LOCATION,
            latitude: point.latitude,
            longitude: point.longitude,
        };

        if (mapRef.current) {
            mapRef.current.animateToRegion(newRegion, 1000);
        } else {
            setCurrentRegion(newRegion); // Fallback if ref not ready
        }

        if (selectingFor === 'pickup') {
            setPickupLocation(point);
        } else {
            setDropoffLocation(point);
        }
        fetchNearbyDrivers(newRegion); // Fetch drivers for new searched area
    };

    const onRegionChangeCompleteDebounced = (region) => {
        setCurrentRegion(region); // Update current region for display/control
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        debounceTimeout.current = setTimeout(() => {
            fetchNearbyDrivers(region);
        }, 1000); // Fetch drivers 1 second after map movement stops
    };


    const confirmLocationsAndProceed = () => {
        if (!pickupLocation || !dropoffLocation) {
            Alert.alert("Locations Missing", "Please select both pickup and dropoff locations.");
            return;
        }
        // Navigate to RequestRideScreen with selected locations
        navigation.navigate('RequestRide', {
            pickup: pickupLocation,
            dropoff: dropoffLocation,
            // You might want to pass address text too if available from Google Places
        });
    };


    return (
        <View style={styles.container}>
            <GooglePlacesAutocomplete
                placeholder={selectingFor === 'pickup' ? 'Search Pickup Location' : 'Search Dropoff Location'}
                onPress={(data, details = null) => {
                    onPlaceSelected(details, data);
                }}
                query={{
                    key: GOOGLE_PLACES_API_KEY,
                    language: 'en', // language of the results
                    components: 'country:gh', // Bias to Ghana
                }}
                fetchDetails={true} // Important to get geometry
                styles={{
                    container: styles.searchContainer,
                    textInput: styles.searchInput,
                    listView: styles.listView,
                }}
                debounce={200}
            />
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={ACCRA_DEFAULT_LOCATION}
                region={currentRegion}
                onRegionChangeComplete={onRegionChangeCompleteDebounced} // Use debounced version
                onPress={handleMapPress}
                showsUserLocation={locationPermissionStatus === RESULTS.GRANTED || locationPermissionStatus === 'granted'}
                showsMyLocationButton={true}
            >
                {userLocation && (
                    <Marker coordinate={userLocation} title="Your Location" pinColor="blue" />
                )}
                {pickupLocation && (
                    <Marker coordinate={pickupLocation} title="Pickup Location" pinColor="green" />
                )}
                {dropoffLocation && (
                    <Marker coordinate={dropoffLocation} title="Dropoff Location" pinColor="red" />
                )}
                {nearbyDrivers.map(driver => ( // Display nearby drivers
                    <Marker
                        key={driver.driver_id}
                        coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
                        title={`Driver ${driver.driver_id.substring(0,6)}...`}
                        description={`Approx. ${driver.distance} km away`}
                        // Use a car icon later
                        // image={require('../assets/car_icon.png')}
                        pinColor="orange"
                    />
                ))}
            </MapView>

            <View style={styles.controlsOverlay}>
                <View style={styles.selectionToggle}>
                    <TouchableOpacity
                        style={[styles.toggleButton, selectingFor === 'pickup' && styles.toggleButtonActive]}
                        onPress={() => setSelectingFor('pickup')}>
                        <Text style={[styles.toggleButtonText, selectingFor === 'pickup' && styles.activeToggleButtonText]}>Set Pickup</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleButton, selectingFor === 'dropoff' && styles.toggleButtonActive]}
                        onPress={() => setSelectingFor('dropoff')}>
                        <Text style={[styles.toggleButtonText, selectingFor === 'dropoff' && styles.activeToggleButtonText]}>Set Dropoff</Text>
                    </TouchableOpacity>
                </View>
                {pickupLocation && dropoffLocation && (
                     <TouchableOpacity style={styles.confirmButton} onPress={confirmLocationsAndProceed}>
                        <Text style={styles.confirmButtonText}>Confirm Ride Locations</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    searchContainer: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 20, // Increased top margin for status bar + notch
        width: '90%', // Slightly less width for better padding from screen edges
        alignSelf: 'center',
        zIndex: 10,
        backgroundColor: 'transparent', // Make container transparent, style input itself
    },
    searchInput: { // This style is for the TextInput within GooglePlacesAutocomplete
        height: 52, // Taller input
        color: '#2c3e50', // Darker text
        fontSize: 16,
        backgroundColor: '#ffffff', // White background for input
        borderWidth: 1,
        borderColor: '#bdc3c7', // Silver border
        borderRadius: 25, // Rounded input
        paddingHorizontal: 20, // More horizontal padding
        elevation: 3, // Shadow for Android
        shadowColor: '#000', // Shadow for iOS
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    listView: {
        backgroundColor: '#ffffff',
        borderRadius: 10, // Rounded corners for list
        marginTop: 8,
        maxHeight: 250, // Slightly more height
        borderWidth: 1,
        borderColor: '#ecf0f1', // Clouds border
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    map: {
        flex: 1,
        zIndex: 1,
    },
    controlsOverlay: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 30 : 20, // Adjust for home indicator on iOS
        left: '5%',
        right: '5%',
        alignItems: 'center',
        zIndex: 5,
    },
    selectionToggle: {
        flexDirection: 'row',
        justifyContent: 'center', // Center buttons if not taking full width
        backgroundColor: 'rgba(255,255,255,0.95)', // More opaque
        borderRadius: 30, // More rounded
        padding: 8, // Padding around buttons
        marginBottom: 15, // More space to confirm button
        elevation: 4, // More shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    toggleButton: {
        paddingVertical: 12, // Taller toggle
        paddingHorizontal: 25, // Wider toggle
        borderRadius: 25, // Fully rounded ends
        marginHorizontal: 5, // Space between toggles
    },
    toggleButtonActive: {
        backgroundColor: '#007AFF', // Primary blue
    },
    toggleButtonText: { // Style for the Text component inside TouchableOpacity
        color: '#333',
        fontWeight: '600', // Bolder
        fontSize: 15,
    },
    activeToggleButtonText: { // Style for Text when button is active
        color: '#fff',
    },
    confirmButton: {
        backgroundColor: '#2ecc71', // Emerald green
        paddingVertical: 16, // Taller button
        paddingHorizontal: 30,
        borderRadius: 30, // Fully rounded
        width: '90%', // Wider button
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 17, // Larger text
        fontWeight: 'bold',
    }
});

export default MapScreen;
