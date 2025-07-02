// backend/src/services/firebaseService.js
const admin = require('firebase-admin');
const path = require('path');

// IMPORTANT: User must download their service account key JSON from Firebase console
// and place it in 'src/config/firebase-service-account.json'
// Ensure this file is added to .gitignore
const serviceAccountPath = path.join(__dirname, '..', 'config', 'firebase-service-account.json');
let firebaseInitialized = false;

try {
    // Check if file exists before trying to initialize
    // fs.existsSync is not available in this environment directly,
    // so initialization will attempt and error will be caught if file is missing.
    // In a local dev setup, you'd use: if (require('fs').existsSync(serviceAccountPath)) { ... }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
        // databaseURL: "https://<YOUR_PROJECT_ID>.firebaseio.com" // Optional: if using Realtime Database
    });
    firebaseInitialized = true;
    console.log('Firebase Admin SDK initialized successfully.');

} catch (error) {
    console.error('Firebase Admin SDK initialization error:', error.message);
    console.warn("Ensure 'firebase-service-account.json' is correctly placed in 'backend/src/config/' and is valid.");
    console.warn("Push notifications will not work until Firebase Admin is initialized.");
    // firebaseInitialized remains false
}

/**
 * Sends a push notification to specified device tokens.
 * @param {string[]} deviceTokens - An array of FCM registration tokens.
 * @param {string} title - The title of the notification.
 * @param {string} body - The body/message of the notification.
 * @param {object} [dataPayload={}] - Optional key-value pairs for custom data.
 * @returns {Promise<boolean>} True if message sent successfully (or at least attempted), false otherwise.
 */
async function sendPushNotification(deviceTokens, title, body, dataPayload = {}) {
    if (!firebaseInitialized) {
        console.error('Firebase Admin SDK not initialized. Cannot send push notification.');
        return false;
    }
    if (!deviceTokens || deviceTokens.length === 0) {
        console.warn('No device tokens provided for push notification.');
        return false;
    }

    const message = {
        notification: {
            title: title,
            body: body,
        },
        tokens: deviceTokens, // Array of device registration tokens
        data: dataPayload, // Custom data to send with the notification
        android: { // Optional: Android specific configuration
            priority: 'high',
            notification: {
                sound: 'default', // or a custom sound file
                // click_action: 'FLUTTER_NOTIFICATION_CLICK', // if using Flutter for specific handling
            },
        },
        apns: { // Optional: APNS specific configuration (iOS)
            payload: {
                aps: {
                    sound: 'default', // or a custom sound file
                    badge: 1, // Example: set badge number
                    // 'content-available': 1, // for silent notifications if needed
                },
            },
        },
    };

    try {
        const response = await admin.messaging().sendMulticast(message);
        console.log('Successfully sent push notification(s):', response.successCount + ' messages');
        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.error(`Failed to send to token ${deviceTokens[idx]}:`, resp.error);
                    // TODO: Handle failed tokens (e.g., mark as invalid in DB if 'unregister' error)
                    if (resp.error.code === 'messaging/registration-token-not-registered') {
                        // Remove this invalid token from your database
                        console.warn(`Token ${deviceTokens[idx]} is not registered. It should be removed.`);
                    }
                }
            });
        }
        return response.successCount > 0;
    } catch (error) {
        console.error('Error sending push notification:', error);
        return false;
    }
}

module.exports = {
    isFirebaseInitialized: () => firebaseInitialized, // Allow checking status
    sendPushNotification
};
