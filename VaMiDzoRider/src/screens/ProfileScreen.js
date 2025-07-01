// VaMiDzoRider/src/screens/ProfileScreen.js
import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, StyleSheet, Alert, ScrollView, ActivityIndicator, TouchableOpacity, Image, Platform
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getMyProfile, updateUserProfile, updateUserProfilePicture, API_BASE_URL } from '../services/api'; // Import API_BASE_URL
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

// Define a base URL for images if they are served from the same backend but without /api/v1
// This needs to be adjusted based on your actual backend file serving setup.
// If profile_picture_url from backend is absolute, this is not needed.
// If it's relative like '/uploads/profile_pictures/image.jpg', then construct full URL.
const API_BASE_URL_FOR_IMAGES = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';


// Reusable components (can be moved)
const CustomButton = ({ title, onPress, style, textStyle, disabled }) => (
    <TouchableOpacity onPress={onPress} style={[styles.buttonBase, style, disabled && styles.buttonDisabled]} disabled={disabled}>
        <Text style={[styles.buttonTextBase, textStyle]}>{title}</Text>
    </TouchableOpacity>
);
const CustomInput = ({ value, onChangeText, placeholder, style, inputStyle, editable = true }) => (
    <View style={[styles.inputContainerBase, style, !editable && styles.inputDisabled_Container]}>
        <TextInput
            style={[styles.inputBase, inputStyle, !editable && styles.inputDisabled_Text]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#888"
            editable={editable}
        />
    </View>
);

const ProfileScreen = () => {
    const { userData, userToken, signOut } = useAuth(); // Get signOut to handle token issues
    const [profileData, setProfileData] = useState(null);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            if (!userToken) { // Should not happen if screen is protected
                setIsLoading(false);
                setError("Not authenticated.");
                return;
            }
            try {
                setIsLoading(true);
                const response = await getMyProfile();
                if (response.data) {
                    setProfileData(response.data);
                    setFirstName(response.data.first_name || '');
                    setLastName(response.data.last_name || '');
                } else {
                    setError("Failed to fetch profile data.");
                }
            } catch (err) {
                console.error("Fetch profile error:", err.response?.data || err.message);
                setError(err.response?.data?.message || "Error fetching profile.");
                if (err.response?.status === 401) { // Token might be invalid
                    Alert.alert("Session Issue", "Your session may have expired. Please login again.", [{text: "OK", onPress: signOut}]);
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [userToken, signOut]);

    const handleUpdateProfile = async () => {
        if (!firstName.trim() && !lastName.trim()) {
            Alert.alert("No Changes", "Please provide a first name or last name to update.");
            return;
        }
        setIsUpdating(true);
        setError('');
        try {
            const dataToUpdate = {};
            if (firstName.trim() !== (profileData?.first_name || '')) dataToUpdate.first_name = firstName.trim();
            if (lastName.trim() !== (profileData?.last_name || '')) dataToUpdate.last_name = lastName.trim();

            if (Object.keys(dataToUpdate).length === 0) {
                Alert.alert("No Changes", "No information was changed.");
                setIsUpdating(false);
                return;
            }

            const response = await updateUserProfile(dataToUpdate);
            if (response.data && response.data.user) {
                setProfileData(response.data.user); // Update local profile state
                setFirstName(response.data.user.first_name || '');
                setLastName(response.data.user.last_name || '');
                // Optionally update AuthContext's userData if it's used globally for display
                // authContext.updateUserData(response.data.user);
                Alert.alert("Success", "Profile updated successfully!");
            } else {
                setError(response.data?.message || "Failed to update profile.");
            }
        } catch (err) {
            console.error("Update profile error:", err.response?.data || err.message);
            setError(err.response?.data?.message || "Error updating profile.");
        } finally {
            setIsUpdating(false);
        }
    };

    const requestMediaPermission = async (type) => {
        let permission;
        if (Platform.OS === 'ios') {
            permission = type === 'camera' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.IOS.PHOTO_LIBRARY;
        } else { // Android
            permission = type === 'camera' ? PERMISSIONS.ANDROID.CAMERA : PERMISSIONS.ANDROID.READ_MEDIA_IMAGES; // Or READ_EXTERNAL_STORAGE for older Android
        }
        const status = await request(permission);
        if (status !== RESULTS.GRANTED) {
            Alert.alert("Permission Denied", `Cannot access ${type === 'camera' ? 'camera' : 'gallery'} without permission.`);
            return false;
        }
        return true;
    };

    const handleChooseImage = (type) => { // type: 'camera' or 'library'
        Alert.alert(
            "Select Profile Picture",
            "Choose an option:",
            [
                { text: "Take Photo...", onPress: () => launchPicker('camera') },
                { text: "Choose from Library...", onPress: () => launchPicker('library') },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    const launchPicker = async (pickerType) => {
        const hasPermission = await requestMediaPermission(pickerType);
        if (!hasPermission) return;

        const options = {
            mediaType: 'photo',
            quality: 0.7, // Compress image a bit
            maxWidth: 800,
            maxHeight: 800,
        };

        const imagePickerLauncher = pickerType === 'camera' ? launchCamera : launchImageLibrary;

        imagePickerLauncher(options, async (response) => {
            if (response.didCancel) {
                console.log('User cancelled image picker');
            } else if (response.errorCode) {
                console.log('ImagePicker Error: ', response.errorMessage);
                Alert.alert("Image Error", response.errorMessage || "Could not select image.");
            } else if (response.assets && response.assets.length > 0) {
                const asset = response.assets[0];
                const formData = new FormData();
                formData.append('profileImage', {
                    uri: Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', ''),
                    type: asset.type,
                    name: asset.fileName || `profile-${Date.now()}.jpg`,
                });

                setIsUpdating(true);
                setError('');
                try {
                    const apiResponse = await updateUserProfilePicture(formData);
                    if (apiResponse.data && apiResponse.data.profile_picture_url) {
                        setProfileData(prev => ({ ...prev, profile_picture_url: apiResponse.data.profile_picture_url }));
                        // Optionally update AuthContext userData if it stores this URL
                        Alert.alert("Success", "Profile picture updated!");
                    } else {
                        setError(apiResponse.data?.message || "Failed to update profile picture URL.");
                    }
                } catch (err) {
                    console.error("Profile Pic Upload Error:", err.response?.data || err.message);
                    setError(err.response?.data?.message || "Error uploading profile picture.");
                } finally {
                    setIsUpdating(false);
                }
            }
        });
    };


    if (isLoading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color="#FF6347" /><Text>Loading Profile...</Text></View>;
    }

    if (error && !profileData) { // Show error prominently if profile fails to load initially
        return <View style={styles.centered}><Text style={styles.errorTextGlobal}>{error}</Text></View>;
    }

    return (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
            <Text style={styles.title}>My Profile</Text>

            {error && <Text style={styles.errorTextGlobal}>{error}</Text>}

            <View style={styles.imageContainer}>
                {profileData?.profile_picture_url ? (
                    <Image
                        source={{ uri: `${API_BASE_URL_FOR_IMAGES}${profileData.profile_picture_url}` }} // Assuming profile_picture_url is relative
                        style={styles.profileImage}
                        onError={(e) => console.log("Image load error:", e.nativeEvent.error)}
                    />
                ) : (
                    <View style={styles.imagePlaceholder}>
                        <Text style={styles.imagePlaceholderText}>No Image</Text>
                    </View>
                )}
            </View>
             <CustomButton
                title="Change Profile Picture"
                onPress={handleChooseImage} // Updated to handleChooseImage
                style={styles.uploadButton}
                disabled={isUpdating}
            />

            <Text style={styles.label}>Phone Number (Cannot be changed here)</Text>
            <CustomInput
                value={profileData?.phone_number || ''}
                editable={false}
                style={styles.inputField}
            />

            <Text style={styles.label}>First Name</Text>
            <CustomInput
                placeholder="Enter first name"
                value={firstName}
                onChangeText={setFirstName}
                style={styles.inputField}
            />

            <Text style={styles.label}>Last Name</Text>
            <CustomInput
                placeholder="Enter last name"
                value={lastName}
                onChangeText={setLastName}
                style={styles.inputField}
            />

            <Text style={styles.label}>Role</Text>
            <CustomInput
                value={profileData?.role || ''}
                editable={false}
                style={styles.inputField}
            />

            {profileData?.role === 'driver' && (
                <>
                    <Text style={styles.label}>License Number</Text>
                    <CustomInput value={profileData?.license_number || ''} editable={false} style={styles.inputField} />
                    <Text style={styles.label}>Vehicle Plate</Text>
                    <CustomInput value={profileData?.vehicle_plate_number || ''} editable={false} style={styles.inputField} />
                    {/* Add more driver specific fields if needed, or link to vehicle management */}
                </>
            )}

            <CustomButton
                title={isUpdating ? "Updating..." : "Update Profile"}
                onPress={handleUpdateProfile}
                disabled={isUpdating}
                style={styles.updateButton}
            />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
        backgroundColor: '#f7f7f7',
    },
    container: {
        padding: 20,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 20,
        textAlign: 'center',
    },
    label: {
        fontSize: 14,
        color: '#555',
        marginBottom: 5,
        marginLeft: 5,
    },
    inputField: {
        marginBottom: 15,
    },
    updateButton: {
        marginTop: 20,
        backgroundColor: '#007bff',
    },
    uploadButton: {
        backgroundColor: '#5bc0de',
        marginBottom: 20,
    },
    errorTextGlobal: {
        color: 'red',
        marginBottom: 15,
        fontSize: 14,
        textAlign: 'center',
    },
    imageContainer: {
        alignItems: 'center',
        marginBottom: 10,
    },
    profileImage: {
        width: 120,
        height: 120,
        borderRadius: 60, // Makes it circular
        borderColor: '#ddd',
        borderWidth: 2,
        backgroundColor: '#eee', // Placeholder while loading or if no image
    },
    imagePlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#e0e0e0',
        justifyContent: 'center',
        alignItems: 'center',
        borderColor: '#ccc',
        borderWidth: 1,
    },
    imagePlaceholderText: {
        fontSize: 14,
        color: '#888',
    },
    // Base styles
    buttonBase: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    buttonTextBase: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonDisabled: {
        backgroundColor: '#ccc',
    },
    inputContainerBase: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        paddingHorizontal: 15,
        minHeight: 48,
        justifyContent: 'center',
    },
    inputBase: {
        fontSize: 16,
        color: '#333',
    },
    inputDisabled_Container: {
        backgroundColor: '#e9ecef',
    },
    inputDisabled_Text: {
        color: '#495057',
    }
});

export default ProfileScreen;
