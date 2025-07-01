// VaMiDzoDriver/src/screens/DocumentUploadScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
// import DocumentPicker from 'react-native-document-picker'; // For actual document picking

// Reusable Button
const CustomButton = ({ title, onPress, style, textStyle, disabled }) => (
    <TouchableOpacity onPress={onPress} style={[styles.buttonBase, style, disabled && styles.buttonDisabled]} disabled={disabled}>
        <Text style={[styles.buttonTextBase, textStyle]}>{title}</Text>
    </TouchableOpacity>
);

const DocumentUploadScreen = ({ navigation }) => {
    const [driversLicense, setDriversLicense] = useState(null);
    const [vehicleRegistration, setVehicleRegistration] = useState(null);
    const [insuranceProof, setInsuranceProof] = useState(null);
    // Add more document states as needed (e.g., roadworthiness cert)
    const [isUploading, setIsUploading] = useState(false);

    const selectDocument = async (docType) => {
        Alert.alert("Select Document", `File picker for ${docType} to be implemented.`);
        // try {
        //     const res = await DocumentPicker.pickSingle({
        //         type: [DocumentPicker.types.images, DocumentPicker.types.pdf], // Allow images and PDFs
        //     });
        //     console.log('Selected document:', res);
        //     switch(docType) {
        //         case 'Driver\'s License': setDriversLicense(res); break;
        //         case 'Vehicle Registration': setVehicleRegistration(res); break;
        //         case 'Proof of Insurance': setInsuranceProof(res); break;
        //         default: break;
        //     }
        // } catch (err) {
        //     if (DocumentPicker.isCancel(err)) {
        //         console.log('User cancelled the picker');
        //     } else {
        //         Alert.alert('Error', 'Could not select document.');
        //         console.error('DocumentPicker Error: ', err);
        //     }
        // }
    };

    const handleUploadAll = async () => {
        if (!driversLicense && !vehicleRegistration && !insuranceProof) {
            Alert.alert("No Documents", "Please select at least one document to upload.");
            return;
        }
        setIsUploading(true);
        Alert.alert("Upload Documents", "Actual upload logic to backend to be implemented.");
        // Simulate upload
        // For each selected document:
        // - Create FormData
        // - Call an API endpoint (e.g., /api/v1/drivers/me/documents)
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsUploading(false);
        Alert.alert("Success (Simulated)", "Documents 'uploaded'. Awaiting verification.");
        // navigation.goBack(); or navigate to a success/pending verification screen
    };

    const renderDocStatus = (doc, name) => {
        return (
            <View style={styles.docRow}>
                <Text style={styles.docName}>{name}:</Text>
                <Text style={doc ? styles.docSelected : styles.docNotSelected}>
                    {doc ? doc.name || 'Selected' : 'Not Selected'}
                </Text>
                <CustomButton title="Select" onPress={() => selectDocument(name)} style={styles.selectButton} textStyle={styles.selectButtonText} />
            </View>
        );
    };

    return (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
            <Text style={styles.title}>Upload Your Documents</Text>
            <Text style={styles.subtitle}>
                Please upload clear copies of the following documents for verification.
            </Text>

            {renderDocStatus(driversLicense, "Driver's License")}
            {renderDocStatus(vehicleRegistration, "Vehicle Registration")}
            {renderDocStatus(insuranceProof, "Proof of Insurance")}
            {/* Add more document types here */}

            <CustomButton
                title={isUploading ? "Uploading..." : "Upload All Selected"}
                onPress={handleUploadAll}
                style={styles.uploadAllButton}
                disabled={isUploading || (!driversLicense && !vehicleRegistration && !insuranceProof)}
            />
             <Text style={styles.note}>
                Supported formats: PDF, JPG, PNG. Max size: 5MB per file.
            </Text>
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
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 25,
        textAlign: 'center',
    },
    docRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    docName: {
        fontSize: 16,
        flex: 1,
    },
    docSelected: {
        fontSize: 14,
        color: 'green',
        fontStyle: 'italic',
        flex: 1,
        textAlign: 'center',
    },
    docNotSelected: {
        fontSize: 14,
        color: 'orange',
        fontStyle: 'italic',
        flex: 1,
        textAlign: 'center',
    },
    selectButton: {
        backgroundColor: '#007bff',
        paddingVertical: 8,
        paddingHorizontal: 15,
        minWidth: 80,
    },
    selectButtonText: {
        fontSize: 14,
    },
    uploadAllButton: {
        marginTop: 30,
        backgroundColor: '#28a745', // Green
    },
    note: {
        fontSize: 12,
        color: 'gray',
        textAlign: 'center',
        marginTop: 20,
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
});

export default DocumentUploadScreen;
