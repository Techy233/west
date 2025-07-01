// VaMiDzoRider/src/services/socketService.js
import io from 'socket.io-client';
import { Platform } from 'react-native';
// import AsyncStorage from '@react-native-async-storage/async-storage'; // To get riderId if needed from storage

const SOCKET_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

let socket = null;

export const initSocket = (riderId) => {
    if (!socket && riderId) {
        socket = io(SOCKET_URL, {
            // transports: ['websocket'],
            // query: { riderId } // Optional: send riderId as query param
        });

        socket.on('connect', () => {
            console.log('Rider socket connected:', riderId, 'with socket ID:', socket.id);
            socket.emit('register_rider_socket', riderId);
        });

        socket.on('rider_socket_registered', (data) => {
            console.log('Rider socket registration acknowledged by server:', data);
        });

        socket.on('rider_socket_registration_failed', (data) => {
            console.error('Rider socket registration failed:', data.message);
        });

        socket.on('disconnect', (reason) => {
            console.log('Rider socket disconnected:', reason);
            // socket = null; // Or manage reconnection attempts
        });

        socket.on('connect_error', (error) => {
            console.error('Rider socket connection error:', error.message);
        });

        socket.on('error_message', (data) => {
            console.error('Server error via rider socket:', data.message);
        });

    } else if (socket && socket.connected && riderId) {
        console.log('Rider socket already connected. Re-registering rider ID:', riderId);
        socket.emit('register_rider_socket', riderId);
    } else if (!riderId) {
        console.warn("Rider socket initialization attempted without riderId.");
    }

    return socket;
};

export const getSocket = () => {
    if (!socket) {
        console.warn("Rider socket not initialized. Call initSocket(riderId) first.");
        return null;
    }
    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        console.log('Disconnecting rider socket...');
        socket.disconnect();
        socket = null;
    }
};

// --- Specific Event Listeners ---
// Components can import these functions to subscribe and unsubscribe

export const onRideAccepted = (callback) => {
  if (socket) socket.on('ride_accepted', callback);
};
export const offRideAccepted = (callback) => {
  if (socket) socket.off('ride_accepted', callback);
};

export const onRideStatusUpdated = (callback) => {
  if (socket) socket.on('ride_status_updated', callback);
};
export const offRideStatusUpdated = (callback) => {
  if (socket) socket.off('ride_status_updated', callback);
};

export const onRideCancelledByDriver = (callback) => {
  if (socket) socket.on('ride_cancelled_by_driver', callback);
};
export const offRideCancelledByDriver = (callback) => {
  if (socket) socket.off('ride_cancelled_by_driver', callback);
};

// Add more event listener helpers as needed
// e.g., for driver location updates, chat messages, etc.
