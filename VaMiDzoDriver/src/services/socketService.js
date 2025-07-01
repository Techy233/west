// VaMiDzoDriver/src/services/socketService.js
import io from 'socket.io-client';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; // To get driverId if needed

// Backend URL for Socket.IO (same as HTTP API base but without /api/v1)
const SOCKET_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

let socket = null;

export const initSocket = (driverId) => {
    if (!socket && driverId) {
        socket = io(SOCKET_URL, {
            // transports: ['websocket'], // You can specify transports if needed
            // query: { driverId } // Optionally send driverId as query param for initial identification
        });

        socket.on('connect', () => {
            console.log('Socket connected for driver:', driverId, 'with socket ID:', socket.id);
            // Register this socket with the backend using the driver's actual ID
            socket.emit('register_driver_socket', driverId);
        });

        socket.on('driver_socket_registered', (data) => {
            console.log('Driver socket registration acknowledged by server:', data);
        });

        socket.on('driver_socket_registration_failed', (data) => {
            console.error('Driver socket registration failed:', data.message);
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            // Handle reconnection logic if needed, though Socket.IO client often handles this.
            // socket = null; // Or manage reconnection attempts
        });

        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error.message);
        });

        // Example: Generic error listener from server
        socket.on('error_message', (data) => {
            console.error('Server error via socket:', data.message);
            // Alert.alert("Server Error", data.message);
        });

    } else if (socket && socket.connected && driverId) {
        // If socket exists and is connected, ensure it's registered with current driverId
        // This might be useful if driverId changes or on re-login without full app restart.
        console.log('Socket already connected. Re-registering driver ID:', driverId);
        socket.emit('register_driver_socket', driverId);
    } else if (!driverId) {
        console.warn("Socket initialization attempted without driverId.");
    }

    return socket; // Return the socket instance for direct use if needed elsewhere
};

export const getSocket = ()_ => {
    // This function might be problematic if initSocket hasn't been called with a driverId.
    // It's better to ensure initSocket is called with driverId upon login/app start.
    if (!socket) {
        console.warn("Socket not initialized. Call initSocket(driverId) first.");
        // Consider a way to retrieve driverId from AsyncStorage here if needed for a lazy init,
        // but passing it explicitly during init is cleaner.
        // Example:
        // const driverData = await AsyncStorage.getItem('driverUserData');
        // if (driverData) {
        //   const parsedData = JSON.parse(driverData);
        //   return initSocket(parsedData.userId);
        // }
        return null;
    }
    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        console.log('Disconnecting socket...');
        socket.disconnect();
        socket = null;
    }
};

// Specific event listeners can be set up here or in the component that needs them.
// Example:
// export const onNewRideRequest = (callback) => {
//   if (socket) {
//     socket.on('new_ride_request', callback);
//   }
// };
// export const offNewRideRequest = (callback) => {
//   if (socket) {
//     socket.off('new_ride_request', callback);
//   }
// };

// export const emitDriverLocation = (locationData) => { // locationData = { driverId, latitude, longitude }
//   if (socket && socket.connected) {
//     socket.emit('driver_location_update', locationData);
//   } else {
//     console.warn("Socket not connected. Cannot emit location.");
//   }
// };
