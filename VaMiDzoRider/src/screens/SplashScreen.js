// VaMiDzoRider/src/screens/SplashScreen.js
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

const SplashScreen = () => {
    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#FF6347" />
            <Text style={styles.loadingText}>Loading VaMiDzo...</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF', // Or your app's splash screen background color
    },
    loadingText: {
        marginTop: 20,
        fontSize: 16,
        color: '#333',
    }
});

export default SplashScreen;
