// VaMiDzoDriver/src/services/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000/api/v1' : 'http://localhost:3000/api/v1';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Interceptor to add JWT token to requests (using driver's token key)
apiClient.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('driverUserToken'); // Key for driver's token
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Basic response error logging (can be expanded)
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error("Driver API Error Response:", error.response?.data || error.message);
        if (error.response?.status === 401) {
            // Handle unauthorized (e.g., clear token, navigate to login)
            // This might be handled by AuthContext as well.
            console.warn("Driver API: Unauthorized access - 401");
        }
        return Promise.reject(error);
    }
);

// --- Authentication related API calls (can be in a separate authService.js too) ---
export const loginUser = (credentials) => { // Generic name, but used for driver login here
    return apiClient.post('/auth/login', credentials);
};

export const registerDriver = (driverData) => {
    return apiClient.post('/auth/register/driver', driverData);
};

export const getMyDriverProfile = () => { // Specific to driver
    return apiClient.get('/auth/me'); // '/auth/me' should return driver specific details if role is driver
};

// --- Ride related API calls for Driver ---
export const acceptRide = (rideId) => {
    return apiClient.post(`/rides/${rideId}/accept`);
};

export const rejectRide = (rideId) => {
    return apiClient.post(`/rides/${rideId}/reject`);
};

export const updateRideStatusByDriver = (rideId, action) => { // action: 'driver_arrived', 'start_trip', 'complete_trip'
    return apiClient.put(`/rides/${rideId}/status`, { action });
};

export const cancelRideByDriver = (rideId, reason) => { // reason might be optional
    return apiClient.post(`/rides/${rideId}/cancel-driver`, { reason });
};

// --- Profile/Vehicle updates for Driver ---
export const updateDriverProfile = (profileData) => {
    return apiClient.put('/users/me', profileData); // Uses the generic user update endpoint
};

export const updateDriverProfilePicture = (formData) => {
    return apiClient.post('/users/me/profile-picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

export const updateDriverVehicleInfo = (vehicleData) => {
    return apiClient.put('/users/me/vehicle', vehicleData); // Endpoint specific to driver vehicle
};


export default apiClient;
