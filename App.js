REPLACE YOUR GITHUB App.js WITH THIS SIMPLIFIED VERSION:

import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Modal, 
  TextInput, 
  Alert,
  StatusBar,
  SafeAreaView,
  Dimensions,
  Share
} from 'react-native';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const { width, height } = Dimensions.get('window');

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isTracking, setIsTracking] = useState(false);
  const [trips, setTrips] = useState([]);
  const [currentTrip, setCurrentTrip] = useState(null);
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [distance, setDistance] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState(null);

  const [newTrip, setNewTrip] = useState({
    startAddress: '',
    endAddress: '',
    distance: '',
    purpose: 'Business',
    notes: ''
  });

  const watchIdRef = useRef(null);
  const timerRef = useRef(null);
  const lastLocationRef = useRef(null);

  const IRS_RATES = {
    'Business': 0.70,
    'Medical': 0.21,
    'Charity': 0.14
  };

  const CATEGORIES = ['Business', 'Medical', 'Charity', 'Personal'];

  useEffect(() => {
    loadSampleTrips();
    requestLocationPermission();
  }, []);

  useEffect(() => {
    if (isTracking && startTime) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTracking, startTime]);

  const loadSampleTrips = () => {
    const sampleTrips = [
      {
        id: Date.now() + 1,
        startAddress: "123 Home St, Your City",
        endAddress: "456 Office Blvd, Business District",
        distance: 12.5,
        purpose: "Business",
        notes: "Client meeting",
        date: new Date(),
        receipts: []
      },
      {
        id: Date.now() + 2,
        startAddress: "456 Office Blvd, Business District",
        endAddress: "789 Medical Center Dr, Health District",
        distance: 8.3,
        purpose: "Medical",
        notes: "Doctor appointment",
        date: new Date(),
        receipts: []
      }
    ];
    
    setTrips(sampleTrips);
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for trip tracking.');
        return;
      }
    } catch (error) {
      console.log('Location permission error:', error);
    }
  };

  const startTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location access is needed for trip tracking.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      setIsTracking(true);
      setStartTime(Date.now());
      setDistance(0);
      setElapsedTime(0);

      console.log('Trip tracking started');
    } catch (error) {
      Alert.alert('Error', 'Failed to start trip tracking');
    }
  };

  const stopTracking = async () => {
    setIsTracking(false);
    setStartTime(null);
    setDistance(0);
    setElapsedTime(0);

    const completedTrip = {
      id: Date.now(),
      startAddress: 'Current Location',
      endAddress: 'End Location',
      distance: Math.random() * 20 + 5, // Sample distance
      purpose: 'Business',
      notes: '',
      date: new Date(),
      receipts: []
    };

    setTrips([completedTrip, ...trips]);
    console.log('Trip completed');
  };

  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const addManualTrip = () => {
    if (!newTrip.startAddress || !newTrip.endAddress || !newTrip.distance) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const trip = {
      id: Date.now(),
      startAddress: newTrip.startAddress,
      endAddress: newTrip.endAddress,
      distance: parseFloat(newTrip.distance),
      purpose: newTrip.purpose,
      notes: newTrip.notes,
      date: new Date(),
      receipts: []
    };

    setTrips([trip, ...trips]);
    setNewTrip({
      startAddress: '',
      endAddress: '',
      distance: '',
      purpose: 'Business',
      notes: ''
    });
    setShowAddTrip(false);
  };

  const exportTrips = async () => {
    try {
      const csvContent = generateCSV(trips);
      const fileUri = `${FileSystem.documentDirectory}mileage_report.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Export Complete', 'Report saved to device');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export trips');
    }
  };

  const generateCSV = (tripsToExport) => {
    const headers = ['Date', 'Start Address', 'End Address', 'Distance (miles)', 'Purpose', 'Deduction', 'Notes'];
    const csvRows = [headers.join(',')];

    tripsToExport.forEach(trip => {
      const deduction = (trip.distance * IRS_RATES[trip.purpose] || 0).toFixed(2);
      const row = [
        trip.date.toLocaleDateString(),
        `"${trip.startAddress}"`,
        `"${trip.endAddress}"`,
        trip.distance.toFixed(1),
        trip.purpose,
        `$${deduction}`,
        `"${trip.notes || ''}"`
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  };

  const renderDashboard = () => {
    const monthlyTrips = trips;
    const totalMiles = monthlyTrips.reduce((sum, trip) => sum + trip.distance, 0);
    const totalDeduction = monthlyTrips.reduce((sum, trip) => 
      sum + (trip.distance * IRS_RATES[trip.purpose] || 0), 0
    );

    return (
      <ScrollView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#667eea" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>MileTracker Pro</Text>
        </View>

        <View style={styles.trackingCard}>
          <Text style={styles.trackingTitle}>Trip Tracking</Text>
          
          {isTracking ? (
            <View style={styles.activeTracking}>
              <Text style={styles.trackingStatus}>🟢 Trip in Progress</Text>
              <Text style={styles.trackingTime}>{formatTime(elapsedTime)}</Text>
              <Text style={styles.trackingDistance}>{distance.toFixed(1)} miles</Text>
              <TouchableOpacity style={styles.stopButton} onPress={stopTracking}>
                <Text style={styles.stopButtonText}>⏹ STOP TRIP</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.inactiveTracking}>
              <TouchableOpacity style={styles.startButton} onPress={startTracking}>
                <Text style={styles.startButtonText}>🚗 START TRIP NOW</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Monthly Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{monthlyTrips.length}</Text>
              <Text style={styles.summaryLabel}>Trips</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalMiles.toFixed(0)}</Text>
              <Text style={styles.summaryLabel}>Miles</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>${totalDeduction.toFixed(0)}</Text>
              <Text style={styles.summaryLabel}>Deduction</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionButton} onPress={() => setShowAddTrip(true)}>
              <Text style={styles.actionIcon}>➕</Text>
              <Text style={styles.actionText}>Add Trip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={exportTrips}>
              <Text style={styles.actionIcon}>📄</Text>
              <Text style={styles.actionText}>Export</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderTrips = () => {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Trip History</Text>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setShowAddTrip(true)}
          >
            <Text style={styles.addButtonText}>+ Add Trip</Text>
          </TouchableOpacity>
        </View>

        {trips.map(trip => (
          <View key={trip.id} style={styles.tripCard}>
            <Text style={styles.tripDate}>
              {trip.date.toLocaleDateString()}
            </Text>
            
            <Text style={styles.tripRoute}>
              {trip.startAddress} → {trip.endAddress}
            </Text>
            
            <View style={styles.tripDetails}>
              <Text style={styles.tripDistance}>{trip.distance.toFixed(1)} miles</Text>
              <Text style={styles.tripPurpose}>{trip.purpose}</Text>
              <Text style={styles.tripDeduction}>
                ${(trip.distance * IRS_RATES[trip.purpose]).toFixed(2)}
              </Text>
            </View>
            
            {trip.notes && (
              <Text style={styles.tripNotes}>{trip.notes}</Text>
            )}
          </View>
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.app}>
        {currentView === 'dashboard' && renderDashboard()}
        {currentView === 'trips' && renderTrips()}
        
        <View style={styles.bottomNav}>
          <TouchableOpacity 
            style={[styles.navButton, currentView === 'dashboard' && styles.navButtonActive]}
            onPress={() => setCurrentView('dashboard')}
          >
            <Text style={styles.navIcon}>🏠</Text>
            <Text style={[styles.navText, currentView === 'dashboard' && styles.navTextActive]}>Home</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.navButton, currentView === 'trips' && styles.navButtonActive]}
            onPress={() => setCurrentView('trips')}
          >
            <Text style={styles.navIcon}>🚗</Text>
            <Text style={[styles.navText, currentView === 'trips' && styles.navTextActive]}>Trips</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={showAddTrip} animationType="slide">
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Manual Trip</Text>
              <TouchableOpacity onPress={() => setShowAddTrip(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Start Address *</Text>
                <TextInput
                  style={styles.textInput}
                  value={newTrip.startAddress}
                  onChangeText={(text) => setNewTrip({...newTrip, startAddress: text})}
                  placeholder="Enter starting location"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>End Address *</Text>
                <TextInput
                  style={styles.textInput}
                  value={newTrip.endAddress}
                  onChangeText={(text) => setNewTrip({...newTrip, endAddress: text})}
                  placeholder="Enter destination"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Distance (miles) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={newTrip.distance}
                  onChangeText={(text) => setNewTrip({...newTrip, distance: text})}
                  placeholder="0.0"
                  keyboardType="numeric"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Purpose</Text>
                <View style={styles.categoryButtons}>
                  {CATEGORIES.map(category => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryButton,
                        newTrip.purpose === category && styles.categoryButtonSelected
                      ]}
                      onPress={() => setNewTrip({...newTrip, purpose: category})}
                    >
                      <Text style={[
                        styles.categoryButtonText,
                        newTrip.purpose === category && styles.categoryButtonTextSelected
                      ]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  style={[styles.textInput, styles.textInputMultiline]}
                  value={newTrip.notes}
                  onChangeText={(text) => setNewTrip({...newTrip, notes: text})}
                  placeholder="Optional notes"
                  multiline
                  numberOfLines={3}
                />
              </View>
              
              <TouchableOpacity style={styles.saveButton} onPress={addManualTrip}>
                <Text style={styles.saveButtonText}>Save Trip</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#667eea',
  },
  app: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#667eea',
    padding: 20,
    paddingTop: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  addButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  trackingCard: {
    backgroundColor: 'white',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trackingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  activeTracking: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  trackingStatus: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#28a745',
    marginBottom: 10,
  },
  trackingTime: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  trackingDistance: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  stopButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  stopButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inactiveTracking: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  startButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryCard: {
    backgroundColor: 'white',
    margin: 15,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  actionsCard: {
    backgroundColor: 'white',
    margin: 15,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 12,
    minWidth: 80,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  actionText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  tripCard: {
    backgroundColor: 'white',
    margin: 15,
    marginBottom: 10,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tripDate: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginBottom: 10,
  },
  tripRoute: {
    fontSize: 14,
    color: '#333',
    marginBottom: 10,
    lineHeight: 18,
  },
  tripDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripDistance: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  tripPurpose: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tripDeduction: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#28a745',
  },
  tripNotes: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  navButtonActive: {
    backgroundColor: '#f0f4ff',
    borderRadius: 12,
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  navText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  navTextActive: {
    color: '#667eea',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    backgroundColor: '#667eea',
    padding: 20,
    paddingTop: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  modalClose: {
    fontSize: 18,
    color: 'white',
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textInputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  categoryButtonSelected: {
    backgroundColor: '#667eea',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#666',
  },
  categoryButtonTextSelected: {
    color: 'white',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
