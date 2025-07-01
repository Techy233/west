// VaMiDzoDriver/src/screens/SplashScreen.js
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

const SplashScreen = () => {
    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#007bff" /> {/* Driver app might have different theme color */}
            <Text style={styles.loadingText}>Loading VaMiDzo Driver...</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    loadingText: {
        marginTop: 20,
        fontSize: 16,
        color: '#333',
    }
});

export default SplashScreen;
