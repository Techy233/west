// VaMiDzoRider/src/services/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define your backend base URL.
// For development, if your backend is running locally on port 3000:
// - Android Emulator: 'http://10.0.2.2:3000/api/v1'
// - iOS Simulator: 'http://localhost:3000/api/v1'
// You might want to use a config file or environment variables for this.
import { Platform } from 'react-native'; // Import Platform

const API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000/api/v1' : 'http://localhost:3000/api/v1';
// Fallback for other platforms or if Platform is not available during test runs etc.
// const API_BASE_URL = 'http://localhost:3000/api/v1';


const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000, // 10 seconds timeout
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Interceptor to add JWT token to requests
apiClient.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Interceptor to handle responses (e.g., for global error handling or token refresh)
apiClient.interceptors.response.use(
    (response) => {
        // Any status code that lie within the range of 2xx cause this function to trigger
        return response;
    },
    (error) => {
        // Any status codes that falls outside the range of 2xx cause this function to trigger
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error("API Error Response:", error.response.data);
            console.error("Status:", error.response.status);
            console.error("Headers:", error.response.headers);

            if (error.response.status === 401) {
                // Handle unauthorized errors (e.g., token expired)
                // You might want to navigate to login screen or attempt token refresh
                // AsyncStorage.removeItem('userToken');
                // AsyncStorage.removeItem('userData');
                // Alert.alert("Session Expired", "Please login again.");
                // Potentially navigate to Login screen using a navigation service accessible here
            }
        } else if (error.request) {
            // The request was made but no response was received
            console.error("API No Response:", error.request);
            // Alert.alert("Network Error", "Could not connect to the server. Please check your internet connection.");
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error("API Request Setup Error:", error.message);
        }
        return Promise.reject(error); // Important to reject so calling code can catch it
    }
);

// Define API service methods
export const loginUser = (credentials) => {
    return apiClient.post('/auth/login', credentials);
};

export const registerRider = (riderData) => {
    return apiClient.post('/auth/register/rider', riderData);
};

export const registerDriver = (driverData) => {
    return apiClient.post('/auth/register/driver', driverData);
};

export const getMyProfile = () => {
    return apiClient.get('/auth/me');
};

export const updateUserProfile = (profileData) => {
    return apiClient.put('/users/me', profileData);
};

// For profile picture, it's multipart/form-data, so headers need adjustment
export const updateUserProfilePicture = (formData) => {
    return apiClient.post('/users/me/profile-picture', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

export const updateUserVehicle = (vehicleData) => {
    return apiClient.put('/users/me/vehicle', vehicleData);
};


// Add more API service methods as needed for rides, etc.
// export const requestRide = (rideDetails) => apiClient.post('/rides', rideDetails);

export default apiClient; // Exporting the configured axios instance if direct use is preferred somewhere
