// VaMiDzoRider/src/screens/ProfileScreen.js
import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, StyleSheet, Alert, ScrollView, ActivityIndicator, TouchableOpacity
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getMyProfile, updateUserProfile, updateUserProfilePicture } from '../services/api';
// For image picker: import ImagePicker from 'react-native-image-picker'; // or react-native-document-picker

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

    const handleProfilePictureUpload = () => {
        // --- Placeholder for react-native-image-picker or react-native-document-picker logic ---
        // 1. Launch image picker
        // 2. Get the selected image URI and type
        // 3. Create FormData object
        //    const formData = new FormData();
        //    formData.append('profileImage', {
        //      uri: imageUri,
        //      type: imageType, // e.g., 'image/jpeg'
        //      name: imageFileName, // e.g., 'profile.jpg'
        //    });
        // 4. Call updateUserProfilePicture(formData)
        // 5. Handle response (update profile_picture_url in state/context)

        Alert.alert(
            "Upload Profile Picture",
            "Image picker functionality to be implemented. This will call the backend endpoint for picture upload.",
            async () => {
                // Simulate an API call for placeholder
                setIsUpdating(true);
                try {
                    // This is a MOCK of what would happen.
                    // const mockFormData = new FormData();
                    // mockFormData.append('info', 'test image upload'); // Cannot send actual file here easily.
                    // const response = await updateUserProfilePicture(mockFormData); // This would fail without real file

                    // Simulate success after a delay
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const simulatedNewUrl = `https://example.com/uploads/profile_pictures/new_pic_${Date.now()}.jpg`;
                    setProfileData(prev => ({...prev, profile_picture_url: simulatedNewUrl}));
                    Alert.alert("Success (Simulated)", "Profile picture 'uploaded' and URL updated.");

                } catch (err) {
                    console.error("Simulated Pic Upload Error:", err.response?.data || err.message);
                    Alert.alert("Error (Simulated)", "Could not 'upload' picture.");
                } finally {
                    setIsUpdating(false);
                }
            }
        );
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

            {profileData?.profile_picture_url && (
                <View style={styles.imageContainer}>
                    {/* In a real app, use <Image source={{uri: profileData.profile_picture_url}} /> */}
                    <Text style={styles.imagePlaceholderText}>[Profile Image Placeholder: {profileData.profile_picture_url}]</Text>
                </View>
            )}
            <CustomButton
                title="Change Profile Picture"
                onPress={handleProfilePictureUpload}
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
    imagePlaceholderText: {
        fontSize: 12,
        color: 'gray',
        borderWidth: 1,
        borderColor: 'lightgray',
        padding: 20,
        textAlign: 'center',
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
