import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  SafeAreaView,
  StatusBar,
  Platform,
  Linking,
  Image,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker, Polyline } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function App() {
  console.log('STANDALONE NATIVE APP v1.0 - GOOGLE PLAY READY');
  
  const [currentView, setCurrentView] = useState('dashboard');
  const [isNavigating, setIsNavigating] = useState(false);
  const [showNavigateModal, setShowNavigateModal] = useState(false);
  const [searchAddress, setSearchAddress] = useState('');
  const [trips, setTrips] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [showTripMap, setShowTripMap] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [newTrip, setNewTrip] = useState({
    startLocation: '',
    endLocation: '',
    distance: '',
    category: 'Business'
  });

  // Receipt capture states
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState({
    category: 'Gas',
    amount: '',
    description: ''
  });
  const [capturedReceipts, setCapturedReceipts] = useState([]);
  const [showReceiptViewer, setShowReceiptViewer] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // Date range export states
  const [showCustomExport, setShowCustomExport] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Subscription limits - competitive 25 trips/month
  const SUBSCRIPTION_LIMITS = {
    free: {
      maxAutoTrips: 25,
      features: ['basic_tracking', 'manual_entry', 'csv_export']
    },
    premium: {
      maxAutoTrips: -1, // unlimited
      features: ['advanced_tracking', 'receipt_capture', 'api_access', 'priority_support']
    }
  };

  const [userSubscription, setUserSubscription] = useState('free');
  const [monthlyTripCount, setMonthlyTripCount] = useState(8); // Current month usage
  const [autoTrackingEnabled, setAutoTrackingEnabled] = useState(true);
  const [backgroundTracking, setBackgroundTracking] = useState(null);
  const [lastKnownLocation, setLastKnownLocation] = useState(null);
  const [movementState, setMovementState] = useState('stationary'); // stationary, moving, driving

  useEffect(() => {
    initializeSampleData();
    requestPermissions();
    if (autoTrackingEnabled) {
      startBackgroundTracking();
    }
    
    return () => {
      if (backgroundTracking) {
        backgroundTracking.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (autoTrackingEnabled && !backgroundTracking) {
      startBackgroundTracking();
    } else if (!autoTrackingEnabled && backgroundTracking) {
      stopBackgroundTracking();
    }
  }, [autoTrackingEnabled]);

  const requestPermissions = async () => {
    try {
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      
      if (locationStatus === 'granted') {
        console.log('Location permission granted');
      }
      if (backgroundStatus === 'granted') {
        console.log('Background location permission granted');
      }
      if (cameraStatus === 'granted') {
        console.log('Camera permission granted');
      }
    } catch (error) {
      console.log('Permission request error:', error);
    }
  };

  const initializeSampleData = () => {
    const sampleTrips = [
      {
        id: '1',
        date: '2025-06-20',
        startLocation: 'Home Office',
        endLocation: 'Client Meeting Downtown',
        distance: 12.5,
        category: 'Business',
        duration: 25,
        cost: 8.75,
      },
      {
        id: '2', 
        date: '2025-06-19',
        startLocation: 'Downtown Office',
        endLocation: 'Medical Center',
        distance: 8.2,
        category: 'Medical',
        duration: 18,
        cost: 1.72,
      },
      {
        id: '3',
        date: '2025-06-18',
        startLocation: 'Home',
        endLocation: 'Charity Event Center',
        distance: 15.3,
        category: 'Charity',
        duration: 32,
        cost: 2.14,
      },
      {
        id: '4',
        date: '2025-06-17',
        startLocation: 'Office Building',
        endLocation: 'Business Conference',
        distance: 22.1,
        category: 'Business',
        duration: 45,
        cost: 15.47,
      },
    ];
    setTrips(sampleTrips);
  };

  const calculateTotals = () => {
    const totalTrips = trips.length;
    const totalDistance = trips.reduce((sum, trip) => sum + trip.distance, 0);
    const totalCost = trips.reduce((sum, trip) => sum + trip.cost, 0);
    return { totalTrips, totalDistance, totalCost };
  };

  const startTracking = async () => {
    // Check subscription limits
    if (userSubscription === 'free' && monthlyTripCount >= SUBSCRIPTION_LIMITS.free.maxAutoTrips) {
      Alert.alert(
        'Upgrade Required - Better Deal Than MileIQ!', 
        `Free plan: ${monthlyTripCount}/${SUBSCRIPTION_LIMITS.free.maxAutoTrips} trips used this month.\n\nMileTracker Pro Premium: $4.99/month\nMileIQ Premium: $5.99-9.99/month\n\nSave 33% with unlimited tracking + manual controls!`,
        [
          { text: 'Continue Free', style: 'cancel' },
          { text: 'Upgrade Now', onPress: () => showUpgradePrompt() }
        ]
      );
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is needed for trip tracking');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const address = await reverseGeocode(location.coords.latitude, location.coords.longitude);
      
      const newTrip = {
        id: Date.now().toString(),
        startTime: new Date(),
        startLocation: address || 'Current Location',
        startCoords: location.coords,
        routeCoords: [location.coords], // Track route for map display
      };

      setActiveTrip(newTrip);
      setIsTracking(true);
      // Increment trip count for free users
      if (userSubscription === 'free') {
        setMonthlyTripCount(prev => prev + 1);
      }
      
      Alert.alert(
        'Trip Started Successfully', 
        'Manual GPS tracking active - tap STOP TRIP when finished.\n\nUnlike MileIQ, you have full control over when trips end!',
        [{ text: 'Got it', style: 'default' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Could not start location tracking');
    }
  };

  const stopTracking = async () => {
    if (!activeTrip) return;

    try {
      const location = await Location.getCurrentPositionAsync({});
      const endTime = new Date();
      const duration = Math.round((endTime - activeTrip.startTime) / 60000);
      const distance = calculateDistance(
        activeTrip.startCoords.latitude,
        activeTrip.startCoords.longitude,
        location.coords.latitude,
        location.coords.longitude
      );

      const endAddress = await reverseGeocode(location.coords.latitude, location.coords.longitude);
      
      const completedTrip = {
        ...activeTrip,
        id: Date.now().toString(),
        date: new Date().toISOString().split('T')[0],
        endLocation: endAddress || 'Current Location',
        endCoords: location.coords,
        distance: Math.max(distance, 0.1),
        duration: Math.max(duration, 1),
        category: 'Uncategorized', // Optional categorization - competitive advantage
        cost: 0, // Calculate after categorization
        routeCoords: [...(activeTrip.routeCoords || []), location.coords]
      };

      setTrips(prev => [completedTrip, ...prev]);
      setActiveTrip(null);
      setIsTracking(false);
      
      // Optional categorization prompt - MileIQ competitive advantage
      Alert.alert(
        'Trip Completed Successfully!',
        `Distance: ${Math.max(distance, 0.1).toFixed(1)} miles\nDuration: ${Math.max(duration, 1)} minutes\n\nUnlike MileIQ, categorization is optional. You can categorize now or later.`,
        [
          { text: 'Skip for Now', style: 'cancel' },
          { text: 'Categorize', onPress: () => showCategorizationModal(completedTrip) }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Could not complete trip');
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const toRadians = (degrees) => degrees * (Math.PI/180);

  const showUpgradePrompt = () => {
    Alert.alert(
      'MileTracker Pro Premium',
      'Competitive advantages over MileIQ:\n\n✓ $4.99/month vs MileIQ\'s $5.99-9.99\n✓ Manual start/stop controls\n✓ Optional categorization\n✓ Instant trip ending\n✓ Receipt capture\n✓ API access\n\nReady to upgrade?',
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Yes, Upgrade!', onPress: () => {
          setUserSubscription('premium');
          Alert.alert('Welcome to Premium!', 'All features unlocked. Enjoy unlimited tracking!');
        }}
      ]
    );
  };

  const showCategorizationModal = (trip) => {
    Alert.alert(
      'Categorize Trip (Optional)',
      `${trip.startLocation} → ${trip.endLocation}\n${trip.distance.toFixed(1)} miles\n\nChoose category for tax deduction calculation:`,
      [
        { text: 'Skip', style: 'cancel' },
        { text: 'Business', onPress: () => updateTripCategory(trip.id, 'Business', 0.70) },
        { text: 'Medical', onPress: () => updateTripCategory(trip.id, 'Medical', 0.21) },
        { text: 'Charity', onPress: () => updateTripCategory(trip.id, 'Charity', 0.14) },
        { text: 'Personal', onPress: () => updateTripCategory(trip.id, 'Personal', 0) }
      ]
    );
  };

  const updateTripCategory = (tripId, category, rate) => {
    setTrips(prev => prev.map(trip => 
      trip.id === tripId 
        ? { ...trip, category, cost: trip.distance * rate }
        : trip
    ));
    Alert.alert('Updated!', `Trip categorized as ${category}. Tax deduction: $${(trips.find(t => t.id === tripId)?.distance * rate || 0).toFixed(2)}`);
  };

  const startBackgroundTracking = async () => {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Background Permission Required', 'Enable "Allow all the time" for automatic trip detection');
        return;
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000, // Check every 30 seconds
          distanceInterval: 100, // Or every 100 meters
        },
        (locationUpdate) => {
          handleBackgroundLocationUpdate(locationUpdate);
        }
      );

      setBackgroundTracking(subscription);
      console.log('Background tracking started');
    } catch (error) {
      console.log('Background tracking error:', error);
    }
  };

  const stopBackgroundTracking = () => {
    if (backgroundTracking) {
      backgroundTracking.remove();
      setBackgroundTracking(null);
      console.log('Background tracking stopped');
    }
  };

  const handleBackgroundLocationUpdate = async (location) => {
    const currentLocation = location.coords;
    const currentTime = new Date();

    if (lastKnownLocation) {
      const distance = calculateDistance(
        lastKnownLocation.latitude,
        lastKnownLocation.longitude,
        currentLocation.latitude,
        currentLocation.longitude
      );

      const timeDiff = (currentTime - new Date(lastKnownLocation.timestamp)) / 1000; // seconds
      const speed = distance > 0 ? (distance / timeDiff) * 3600 : 0; // mph

      // Detect driving vs walking vs stationary
      if (speed > 5 && distance > 0.1) { // Moving faster than 5 mph
        if (movementState === 'stationary' && !activeTrip) {
          // Start automatic trip
          await startAutomaticTrip(currentLocation);
        }
        setMovementState('driving');
      } else if (speed < 2 && movementState === 'driving') {
        // Stopped driving, end automatic trip
        if (activeTrip && !isTracking) { // Only end auto trips, not manual ones
          await endAutomaticTrip(currentLocation);
        }
        setMovementState('stationary');
      }
    }

    setLastKnownLocation({
      ...currentLocation,
      timestamp: currentTime
    });
  };

  const startAutomaticTrip = async (location) => {
    // Check subscription limits
    if (userSubscription === 'free' && monthlyTripCount >= SUBSCRIPTION_LIMITS.free.maxAutoTrips) {
      return; // Silently skip if over limit
    }

    try {
      const address = await reverseGeocode(location.latitude, location.longitude);
      
      const newTrip = {
        id: Date.now().toString(),
        startTime: new Date(),
        startLocation: address || 'Unknown Location',
        startCoords: location,
        routeCoords: [location],
        isAutomatic: true,
      };

      setActiveTrip(newTrip);
      
      if (userSubscription === 'free') {
        setMonthlyTripCount(prev => prev + 1);
      }
      
      console.log('Automatic trip started:', address);
    } catch (error) {
      console.log('Auto trip start error:', error);
    }
  };

  const endAutomaticTrip = async (location) => {
    if (!activeTrip || !activeTrip.isAutomatic) return;

    try {
      const endAddress = await reverseGeocode(location.latitude, location.longitude);
      const endTime = new Date();
      const duration = Math.round((endTime - activeTrip.startTime) / 60000);
      const distance = calculateDistance(
        activeTrip.startCoords.latitude,
        activeTrip.startCoords.longitude,
        location.latitude,
        location.longitude
      );

      // Only save trips over 0.5 miles
      if (distance >= 0.5) {
        const completedTrip = {
          ...activeTrip,
          id: Date.now().toString(),
          date: new Date().toISOString().split('T')[0],
          endLocation: endAddress || 'Unknown Location',
          endCoords: location,
          distance: Math.max(distance, 0.1),
          duration: Math.max(duration, 1),
          category: 'Uncategorized',
          cost: 0,
          routeCoords: [...(activeTrip.routeCoords || []), location]
        };

        setTrips(prev => [completedTrip, ...prev]);
        console.log('Automatic trip completed:', distance.toFixed(1), 'miles');
      }

      setActiveTrip(null);
    } catch (error) {
      console.log('Auto trip end error:', error);
    }
  };

  const addTrip = () => {
    const distance = parseFloat(newTrip.distance);
    if (!newTrip.startLocation || !newTrip.endLocation || !distance) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const cost = distance * (newTrip.category === 'Business' ? 0.70 : 
                            newTrip.category === 'Medical' ? 0.21 : 
                            newTrip.category === 'Charity' ? 0.14 : 0);

    const trip = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      startLocation: newTrip.startLocation,
      endLocation: newTrip.endLocation,
      distance: distance,
      category: newTrip.category,
      duration: Math.round(distance * 2), // Estimate 2 minutes per mile
      cost: cost,
    };

    setTrips(prev => [trip, ...prev]);
    setNewTrip({ startLocation: '', endLocation: '', distance: '', category: 'Business' });
    setShowAddTrip(false);
    Alert.alert('Trip Added', `${distance} mile ${newTrip.category.toLowerCase()} trip saved`);
  };

  const exportCSV = async () => {
    try {
      const csvContent = [
        'Date,Start Location,End Location,Distance (mi),Category,Duration (min),Cost ($)',
        ...trips.map(trip => 
          `${trip.date},"${trip.startLocation}","${trip.endLocation}",${trip.distance},${trip.category},${trip.duration},${trip.cost.toFixed(2)}`
        )
      ].join('\n');

      const { totalTrips, totalDistance, totalCost } = calculateTotals();
      const fullContent = csvContent + `\n\nSummary:,,,${totalDistance.toFixed(1)},${totalTrips} trips,,$${totalCost.toFixed(2)}`;

      const fileUri = FileSystem.documentDirectory + 'miletracker_export.csv';
      await FileSystem.writeAsStringAsync(fileUri, fullContent);

      if (await MailComposer.isAvailableAsync()) {
        await MailComposer.composeAsync({
          subject: 'MileTracker Pro Export - Tax Records',
          body: `Your mileage data export is attached.\n\nSummary:\n- Total Trips: ${totalTrips}\n- Total Distance: ${totalDistance.toFixed(1)} miles\n- Total Deduction: $${totalCost.toFixed(2)}`,
          attachments: [fileUri],
        });
      } else {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Trip Data'
        });
      }
    } catch (error) {
      Alert.alert('Export Error', 'Could not export trip data');
    }
  };

  const reverseGeocode = async (latitude, longitude) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results && results.length > 0) {
        const result = results[0];
        return `${result.street || ''} ${result.city || ''}, ${result.region || ''}`.trim();
      }
      return null;
    } catch (error) {
      console.log('Reverse geocoding error:', error);
      return null;
    }
  };



  const viewTripOnMap = (trip) => {
    setSelectedTrip(trip);
    setShowTripMap(true);
  };

  const openNavigation = (trip) => {
    if (!trip.startCoords && !trip.endCoords) {
      Alert.alert('Navigation Unavailable', 'GPS coordinates not available for this trip');
      return;
    }

    Alert.alert(
      'Navigate Where?',
      'Where would you like to go?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `To: ${trip.endLocation.substring(0, 30)}...`,
          onPress: () => navigateToLocation(trip.endCoords || trip.startCoords, trip.endLocation)
        },
        {
          text: `From: ${trip.startLocation.substring(0, 30)}...`,
          onPress: () => navigateToLocation(trip.startCoords || trip.endCoords, trip.startLocation)
        }
      ]
    );
  };

  const navigateToLocation = (coords, locationName) => {
    const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords.latitude},${coords.longitude}`;
    const appleUrl = `http://maps.apple.com/?daddr=${coords.latitude},${coords.longitude}`;

    Alert.alert(
      `Navigate to ${locationName.substring(0, 40)}...`,
      'Choose your navigation app:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Google Maps', onPress: () => Linking.openURL(googleUrl) },
        { text: 'Apple Maps', onPress: () => Linking.openURL(appleUrl) }
      ]
    );
  };

  const navigateToNewPlace = () => {
    if (!searchAddress.trim()) {
      Alert.alert('Enter Address', 'Please enter an address or place name');
      return;
    }

    const encodedAddress = encodeURIComponent(searchAddress.trim());
    const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
    const appleUrl = `http://maps.apple.com/?daddr=${encodedAddress}`;

    Alert.alert(
      'Navigate & Track Trip?',
      'Would you like to start trip tracking when you begin navigation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Navigate Only',
          onPress: () => {
            Alert.alert(
              'Choose Navigation App',
              `Navigate to: ${searchAddress}`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Google Maps', onPress: () => Linking.openURL(googleUrl) },
                { text: 'Apple Maps', onPress: () => Linking.openURL(appleUrl) }
              ]
            );
            setShowNavigateModal(false);
            setSearchAddress('');
          }
        },
        {
          text: 'Navigate + Track',
          onPress: () => {
            startTracking();
            Alert.alert(
              'Trip Started!',
              `Navigation opening to: ${searchAddress}`,
              [
                { text: 'Google Maps', onPress: () => Linking.openURL(googleUrl) },
                { text: 'Apple Maps', onPress: () => Linking.openURL(appleUrl) }
              ]
            );
            setShowNavigateModal(false);
            setSearchAddress('');
          }
        }
      ]
    );
  };



  const addManualTrip = () => {
    const distance = parseFloat(newTrip.distance);
    const rates = {
      Business: 0.70,
      Medical: 0.21,
      Charity: 0.14
    };

    const trip = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      startLocation: newTrip.startLocation,
      endLocation: newTrip.endLocation,
      distance: distance,
      category: newTrip.category,
      duration: Math.round(distance * 2),
      cost: distance * rates[newTrip.category],
    };

    setTrips(prev => [trip, ...prev]);
    setNewTrip({ startLocation: '', endLocation: '', distance: '', category: 'Business' });
    setShowAddTrip(false);
    Alert.alert('Trip Added', 'Manual trip has been saved');
  };

  // Receipt capture functions
  const openReceiptCapture = (trip) => {
    setSelectedTrip(trip);
    setShowReceiptModal(true);
  };

  const handleNavigate = (view) => {
    if (isNavigating) return;
    
    setIsNavigating(true);
    console.log(`Navigating to ${view}`);
    
    // Close any open modals first
    setShowAddTrip(false);
    setShowReceiptModal(false);
    setShowTripMap(false);
    setShowNavigateModal(false);
    
    setTimeout(() => {
      setCurrentView(view);
      setIsNavigating(false);
    }, 100);
  };

  const captureReceipt = async () => {
    try {
      Alert.alert(
        'Add Receipt Photo',
        'Choose how to add your receipt image:',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: () => launchCamera() },
          { text: 'Choose from Gallery', onPress: () => launchGallery() }
        ]
      );
    } catch (error) {
      console.error('Capture receipt error:', error);
      Alert.alert('Camera Error', 'Failed to capture receipt');
    }
  };

  const launchCamera = async () => {
    try {
      // Request both camera and media library permissions
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (cameraPermission.status !== 'granted') {
        Alert.alert('Camera Permission Required', 'Please enable camera access to take receipt photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: undefined, // Free-form cropping for receipts
        presentationStyle: 'fullScreen',
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        saveReceiptImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Camera Error', 'Failed to open camera: ' + error.message);
    }
  };

  const launchGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Gallery permissions are required to select photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: undefined, // Allow flexible cropping for long receipts
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        saveReceiptImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Gallery Error', 'Failed to select image');
    }
  };

  const saveReceiptImage = (imageUri) => {
    const newReceipt = {
      id: Date.now(),
      tripId: selectedTrip?.id,
      category: receiptData.category,
      amount: receiptData.amount || '0.00',
      description: receiptData.description,
      imageUri: imageUri,
      timestamp: new Date().toISOString(),
      tripLocation: selectedTrip?.startLocation || 'Current Trip'
    };
    
    setCapturedReceipts(prev => [...prev, newReceipt]);
    
    Alert.alert('Receipt Saved!', `Receipt captured for ${selectedTrip?.startLocation || 'Current Trip'}`);
    
    setShowReceiptModal(false);
    setReceiptData({ category: 'Gas', amount: '', description: '' });
  };

  // Date range export functions
  const exportReceiptsWithDateRange = () => {
    setShowCustomExport(true);
  };

  const showExportOptionsModal = (receipts, periodName) => {
    Alert.alert(
      'Export Options',
      'Choose what to include in your export:',
      [
        {
          text: 'CSV Report Only',
          onPress: () => generateReceiptReport(receipts, periodName, 'csv-only')
        },
        {
          text: 'CSV + Receipt Images',
          onPress: () => generateReceiptReport(receipts, periodName, 'csv-with-images')
        },
        {
          text: 'Save to Cloud Storage',
          onPress: () => generateReceiptReport(receipts, periodName, 'cloud-storage')
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const generateReceiptReport = async (receipts, periodName, exportType = 'csv-only') => {
    try {
      const totalAmount = receipts.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
      
      const csvHeader = 'Date,Category,Amount,Description,Trip Location,Receipt ID\n';
      const csvRows = receipts.map(receipt => {
        const date = new Date(receipt.timestamp).toLocaleDateString();
        return `"${date}","${receipt.category}","${receipt.amount}","${receipt.description}","${receipt.tripLocation}","${receipt.id}"`;
      }).join('\n');
      
      const csvContent = csvHeader + csvRows;
      const summaryText = `${periodName} Expense Report\nGenerated: ${new Date().toLocaleDateString()}\n\nTotal Receipts: ${receipts.length}\nTotal Amount: $${totalAmount.toFixed(2)}\n\nCSV Data:\n${csvContent}`;

      const safeFilename = periodName.replace(/[^a-zA-Z0-9]/g, '_');
      const csvFilename = `${safeFilename}_Expense_Report_${new Date().toISOString().split('T')[0]}.csv`;
      const csvPath = FileSystem.documentDirectory + csvFilename;
      
      await FileSystem.writeAsStringAsync(csvPath, csvContent);

      if (exportType === 'csv-only') {
        if (await MailComposer.isAvailableAsync()) {
          await MailComposer.composeAsync({
            subject: `${periodName} Expense Report`,
            body: summaryText,
            attachments: [csvPath],
          });
        } else {
          await Sharing.shareAsync(csvPath);
        }
      } else if (exportType === 'csv-with-images') {
        const attachments = [csvPath];
        const receiptImages = receipts.filter(r => r.imageUri).slice(0, 5); // Limit to 5 images to prevent email size issues
        
        receiptImages.forEach(receipt => {
          if (receipt.imageUri) {
            attachments.push(receipt.imageUri);
          }
        });

        if (await MailComposer.isAvailableAsync()) {
          await MailComposer.composeAsync({
            subject: `${periodName} Expense Report with Receipts`,
            body: `${summaryText}\n\nIncluded ${receiptImages.length} receipt images (limited to 5 for email size).`,
            attachments: attachments,
          });
        } else {
          await Sharing.shareAsync(csvPath);
        }
      } else if (exportType === 'cloud-storage') {
        await Sharing.shareAsync(csvPath, {
          dialogTitle: 'Save to Cloud Storage',
          mimeType: 'text/csv'
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Error', 'Failed to generate receipt report');
    }
  };

  const exportPresetPeriod = async (period) => {
    const now = new Date();
    let startDate, endDate = now;
    
    switch (period) {
      case 'Weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'Monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'Quarterly':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
    }

    const filteredReceipts = capturedReceipts.filter(receipt => {
      const receiptDate = new Date(receipt.timestamp);
      return receiptDate >= startDate && receiptDate <= endDate;
    });

    if (filteredReceipts.length === 0) {
      Alert.alert('No Receipts', `No receipts found for ${period.toLowerCase()} period.`);
      return;
    }

    showExportOptionsModal(filteredReceipts, `${period} Report`);
  };

  const exportCustomDateRange = async () => {
    try {
      if (!customDateRange.startDate || !customDateRange.endDate) {
        Alert.alert('Date Range Required', 'Please enter both start and end dates.');
        return;
      }

      const startDate = new Date(customDateRange.startDate + 'T00:00:00');
      const endDate = new Date(customDateRange.endDate + 'T23:59:59');
      
      if (startDate > endDate) {
        Alert.alert('Invalid Date Range', 'Start date must be before end date.');
        return;
      }

      const rangeReceipts = capturedReceipts.filter(receipt => {
        const receiptDate = new Date(receipt.timestamp);
        return receiptDate >= startDate && receiptDate <= endDate;
      });

      if (rangeReceipts.length === 0) {
        Alert.alert(
          'No Receipts Found', 
          `No receipts found between ${startDate.toLocaleDateString()} and ${endDate.toLocaleDateString()}.`
        );
        return;
      }

      const periodName = `Custom Range (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`;
      showExportOptionsModal(rangeReceipts, periodName);
      setShowCustomExport(false);
    } catch (error) {
      console.error('Custom export error:', error);
      Alert.alert('Export Error', 'Failed to generate custom receipt report');
    }
  };

  const renderDashboard = () => {
    const { totalTrips, totalDistance, totalCost } = calculateTotals();

    return (
      <ScrollView style={styles.container}>
        <View style={styles.featureHighlight}>
          <Text style={styles.featureTitle}>🚗 Professional Mileage Tracking</Text>
          <Text style={styles.featureSubtitle}>$4.99/month • Manual Controls • Auto Detection • Tax Ready Reports</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>June 2025 Summary</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{totalTrips}</Text>
              <Text style={styles.summaryLabel}>Trips</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{totalDistance.toFixed(1)}</Text>
              <Text style={styles.summaryLabel}>Mi</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>${totalCost.toFixed(0)}</Text>
              <Text style={styles.summaryLabel}>IRS</Text>
            </View>
          </View>
          <Text style={styles.irsExplanation}>
            IRS deduction = Business trips ($0.70/mi) + Medical trips ($0.21/mi) + Charity trips ($0.14/mi)
          </Text>
        </View>

        <View style={styles.trackingCard}>
          <Text style={styles.subscriptionStatus}>
            {userSubscription === 'free' ? 
              `Free Plan: ${monthlyTripCount}/${SUBSCRIPTION_LIMITS.free.maxAutoTrips} trips used` :
              'Premium: Unlimited tracking'
            }
          </Text>
          
          <View style={styles.trackingModeToggle}>
            <TouchableOpacity 
              style={[styles.modeButton, autoTrackingEnabled && styles.modeButtonActive]}
              onPress={() => setAutoTrackingEnabled(true)}
            >
              <Text style={[styles.modeButtonText, autoTrackingEnabled && styles.modeButtonTextActive]}>
                🤖 Auto Trips
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modeButton, !autoTrackingEnabled && styles.modeButtonActive]}
              onPress={() => setAutoTrackingEnabled(false)}
            >
              <Text style={[styles.modeButtonText, !autoTrackingEnabled && styles.modeButtonTextActive]}>
                👆 Manual Only
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.modeExplanation}>
            Auto: Detects driving automatically • Manual: Full start/stop control
          </Text>
          
          {isTracking ? (
            <View style={styles.trackingActive}>
              <Text style={styles.trackingStatus}>🔴 Trip in Progress</Text>
              <Text style={styles.trackingNote}>Manual control - stop when finished</Text>
              <Text style={styles.advantageText}>✓ No forced 10-minute wait ✓ Stop anytime ✓ Your choice</Text>
              
              <TouchableOpacity style={styles.bigStopButton} onPress={stopTracking}>
                <Text style={styles.bigButtonText}>🛑 STOP TRIP NOW</Text>
                <Text style={styles.bigButtonSubtext}>Instant trip ending</Text>
              </TouchableOpacity>
            </View>
          ) : autoTrackingEnabled ? (
            <View style={styles.trackingInactive}>
              <Text style={styles.trackingStatus}>🤖 Automatic Trip Detection</Text>
              <Text style={styles.advantageText}>✓ Detects driving automatically ✓ No button pressing ✓ Background tracking</Text>
              <Text style={styles.autoStatus}>
                {backgroundTracking ? 
                  `🟢 Auto tracking active • ${movementState === 'driving' ? 'Driving detected' : 'Waiting for movement'}` :
                  '🔴 Background permission needed'
                }
              </Text>
              
              <TouchableOpacity style={styles.manualEntryButton} onPress={() => setShowAddTrip(true)}>
                <Text style={styles.manualButtonText}>+ Add Manual Trip</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.trackingInactive}>
              <Text style={styles.trackingStatus}>👆 Manual Trip Control</Text>
              <Text style={styles.advantageText}>✓ Instant start/stop ✓ Full control ✓ No delays</Text>
              
              <TouchableOpacity style={styles.bigStartButton} onPress={startTracking}>
                <Text style={styles.bigButtonText}>🚗 START TRIP NOW</Text>
                <Text style={styles.bigButtonSubtext}>Instant tracking control</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.navigateButton} onPress={() => setShowNavigateModal(true)}>
                <Text style={styles.navigateButtonText}>🧭 NAVIGATE TO NEW PLACE</Text>
                <Text style={styles.navigateButtonSubtext}>Find & go to any address</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.manualEntryButton} onPress={() => setShowAddTrip(true)}>
                <Text style={styles.manualButtonText}>+ Add Manual Trip</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.recentTitle}>Recent Trips</Text>
        {trips.slice(0, 3).map(trip => (
          <View key={trip.id} style={styles.tripCard}>
            <Text style={styles.tripDate}>{trip.date}</Text>
            <Text style={styles.tripRoute} numberOfLines={2}>
              {trip.startLocation} → {trip.endLocation}
            </Text>
            <View style={styles.tripDetails}>
              <Text style={styles.tripDistance}>{trip.distance} mi</Text>
              <Text style={styles.tripCategory}>{trip.category}</Text>
              <Text style={styles.tripCost}>${trip.cost.toFixed(2)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderTrips = () => (
    <ScrollView style={styles.container}>
      <View style={styles.tripsHeader}>
        <Text style={styles.tripsTitle}>All Trips</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddTrip(true)}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {trips.map(trip => {
        const tripReceipts = capturedReceipts.filter(receipt => receipt.tripId === trip.id);
        return (
          <View key={trip.id} style={styles.tripCard}>
            <View style={styles.tripHeader}>
              <Text style={styles.tripDate}>{trip.date}</Text>
              {tripReceipts.length > 0 && (
                <View style={styles.receiptThumbnailContainer}>
                  <Image 
                    source={{ uri: tripReceipts[0].imageUri }} 
                    style={styles.receiptThumbnail}
                  />
                  {tripReceipts.length > 1 && (
                    <Text style={styles.receiptCount}>+{tripReceipts.length - 1}</Text>
                  )}
                </View>
              )}
            </View>
            <Text style={styles.tripRoute} numberOfLines={2}>
              {trip.startLocation} → {trip.endLocation}
            </Text>
            <View style={styles.tripDetails}>
              <Text style={styles.tripDistance}>{trip.distance} mi</Text>
              <Text style={styles.tripCategory}>{trip.category}</Text>
              <Text style={styles.tripCost}>${trip.cost.toFixed(2)}</Text>
            </View>
            <View style={styles.tripActions}>
              <TouchableOpacity style={styles.receiptButton} onPress={() => openReceiptCapture(trip)}>
                <Text style={styles.receiptButtonText}>📄 Receipt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mapButton} onPress={() => viewTripOnMap(trip)}>
                <Text style={styles.mapButtonText}>🗺 Map</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.navButton} onPress={() => openNavigation(trip)}>
                <Text style={styles.navButtonText}>🧭 Navigate</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );

  const renderExport = () => (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.exportCard}>
        <Text style={styles.exportTitle}>Export Trip Data</Text>
        <Text style={styles.exportDescription}>
          Generate CSV file for taxes, employee reimbursements, and contractor payments
        </Text>
        <TouchableOpacity style={styles.exportButton} onPress={exportCSV}>
          <Text style={styles.buttonText}>Export All Trips CSV</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.exportCard}>
        <Text style={styles.exportTitle}>Export Receipts</Text>
        <Text style={styles.exportDescription}>
          Export receipt reports for employee reimbursements, contractor payments, and tax documentation
        </Text>
        <TouchableOpacity style={styles.exportButton} onPress={exportReceiptsWithDateRange}>
          <Text style={styles.buttonText}>Export Receipt Reports</Text>
        </TouchableOpacity>
        
        <View style={styles.presetButtons}>
          <TouchableOpacity style={styles.presetButton} onPress={() => exportPresetPeriod('Weekly')}>
            <Text style={styles.presetButtonText}>7d</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetButton} onPress={() => exportPresetPeriod('Monthly')}>
            <Text style={styles.presetButtonText}>30d</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetButton} onPress={() => exportPresetPeriod('Quarterly')}>
            <Text style={styles.presetButtonText}>90d</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.presetNote}>d = days (7d = weekly, 30d = monthly, 90d = quarterly)</Text>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ExpoStatusBar style="light" backgroundColor="#667eea" />
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MileTracker Pro</Text>
        <Text style={styles.headerSubtitle}>Native Android App</Text>
      </View>

      {currentView === 'dashboard' && renderDashboard()}
      {currentView === 'trips' && renderTrips()}
      {currentView === 'export' && renderExport()}

      <Modal visible={showAddTrip} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Manual Trip</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Start Location"
              value={newTrip.startLocation}
              onChangeText={(text) => setNewTrip(prev => ({...prev, startLocation: text}))}
            />
            
            <TextInput
              style={styles.input}
              placeholder="End Location"
              value={newTrip.endLocation}
              onChangeText={(text) => setNewTrip(prev => ({...prev, endLocation: text}))}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Distance (miles)"
              value={newTrip.distance}
              onChangeText={(text) => setNewTrip(prev => ({...prev, distance: text}))}
              keyboardType="numeric"
            />

            <View style={styles.categoryRow}>
              {['Business', 'Medical', 'Charity'].map(category => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryButton,
                    newTrip.category === category && styles.categoryButtonActive
                  ]}
                  onPress={() => setNewTrip(prev => ({...prev, category}))}
                >
                  <Text style={[
                    styles.categoryButtonText,
                    newTrip.category === category && styles.categoryButtonTextActive
                  ]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddTrip(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={addManualTrip}>
                <Text style={styles.saveButtonText}>Save Trip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showTripMap} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.mapModalContainer}>
          <View style={styles.mapHeader}>
            <TouchableOpacity onPress={() => setShowTripMap(false)}>
              <Text style={styles.mapCloseButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.mapTitle}>Trip Route</Text>
            <TouchableOpacity onPress={() => selectedTrip && openNavigation(selectedTrip)}>
              <Text style={styles.mapNavButton}>Navigate</Text>
            </TouchableOpacity>
          </View>
          
          {selectedTrip && (
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: selectedTrip.startCoords?.latitude || 37.7749,
                  longitude: selectedTrip.startCoords?.longitude || -122.4194,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
              >
                {selectedTrip.startCoords && (
                  <Marker
                    coordinate={selectedTrip.startCoords}
                    title="Start"
                    description={selectedTrip.startLocation}
                    pinColor="green"
                  />
                )}
                {selectedTrip.endCoords && (
                  <Marker
                    coordinate={selectedTrip.endCoords}
                    title="End"
                    description={selectedTrip.endLocation}
                    pinColor="red"
                  />
                )}
                {selectedTrip.routeCoords && selectedTrip.routeCoords.length > 1 && (
                  <Polyline
                    coordinates={selectedTrip.routeCoords}
                    strokeColor="#667eea"
                    strokeWidth={4}
                  />
                )}
              </MapView>
              
              <View style={styles.mapDetails}>
                <Text style={styles.mapTripInfo}>
                  {selectedTrip.startLocation} → {selectedTrip.endLocation}
                </Text>
                <Text style={styles.mapTripData}>
                  {selectedTrip.distance} miles • {selectedTrip.category} • ${selectedTrip.cost.toFixed(2)}
                </Text>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Receipt Capture Modal */}
      <Modal visible={showReceiptModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Receipt</Text>
            <Text style={styles.modalSubtitle}>Trip: {selectedTrip?.startLocation} → {selectedTrip?.endLocation}</Text>
            
            <View style={styles.categoryRow}>
              {['Gas', 'Parking', 'Maintenance', 'Insurance', 'Other'].map(category => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryButton,
                    receiptData.category === category && styles.categoryButtonActive
                  ]}
                  onPress={() => setReceiptData(prev => ({...prev, category}))}
                >
                  <Text style={[
                    styles.categoryButtonText,
                    receiptData.category === category && styles.categoryButtonTextActive
                  ]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Amount ($)"
              value={receiptData.amount}
              onChangeText={(text) => setReceiptData(prev => ({...prev, amount: text}))}
              keyboardType="numeric"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Description (optional)"
              value={receiptData.description}
              onChangeText={(text) => setReceiptData(prev => ({...prev, description: text}))}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowReceiptModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={captureReceipt}>
                <Text style={styles.saveButtonText}>Capture Receipt</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Date Range Export Modal */}
      <Modal visible={showCustomExport} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Custom Date Range Export</Text>
            <Text style={styles.modalSubtitle}>Select date range for receipt export</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Start Date</Text>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {customDateRange.startDate || 'Select start date'}
                </Text>
              </TouchableOpacity>
              {showStartDatePicker && (
                <DateTimePicker
                  value={customDateRange.startDate ? new Date(customDateRange.startDate) : new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowStartDatePicker(false);
                    if (selectedDate) {
                      const year = selectedDate.getFullYear();
                      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                      const day = String(selectedDate.getDate()).padStart(2, '0');
                      const localDateString = `${year}-${month}-${day}`;
                      setCustomDateRange(prev => ({ 
                        ...prev, 
                        startDate: localDateString 
                      }));
                    }
                  }}
                />
              )}
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>End Date</Text>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {customDateRange.endDate || 'Select end date'}
                </Text>
              </TouchableOpacity>
              {showEndDatePicker && (
                <DateTimePicker
                  value={customDateRange.endDate ? new Date(customDateRange.endDate) : new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowEndDatePicker(false);
                    if (selectedDate) {
                      const year = selectedDate.getFullYear();
                      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                      const day = String(selectedDate.getDate()).padStart(2, '0');
                      const localDateString = `${year}-${month}-${day}`;
                      setCustomDateRange(prev => ({ 
                        ...prev, 
                        endDate: localDateString 
                      }));
                    }
                  }}
                />
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowCustomExport(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={exportCustomDateRange}>
                <Text style={styles.saveButtonText}>Export Range</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Navigate to New Place Modal */}
      <Modal visible={showNavigateModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Navigate to New Place</Text>
            <Text style={styles.modalSubtitle}>Enter address, business name, or landmark</Text>
            
            <TextInput
              style={styles.input}
              placeholder="e.g. 123 Main St, Coffee Shop, Hospital"
              value={searchAddress}
              onChangeText={setSearchAddress}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={navigateToNewPlace}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => {
                setShowNavigateModal(false);
                setSearchAddress('');
              }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={navigateToNewPlace}>
                <Text style={styles.saveButtonText}>Navigate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={[styles.navItem, currentView === 'dashboard' && styles.navItemActive]}
          onPress={() => handleNavigate('dashboard')}
          disabled={isNavigating}
        >
          <Text style={[styles.navText, currentView === 'dashboard' && styles.navTextActive]}>
            Home
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.navItem, currentView === 'trips' && styles.navItemActive]}
          onPress={() => handleNavigate('trips')}
          disabled={isNavigating}
        >
          <Text style={[styles.navText, currentView === 'trips' && styles.navTextActive]}>
            Trips
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.navItem, currentView === 'export' && styles.navItemActive]}
          onPress={() => handleNavigate('export')}
          disabled={isNavigating}
        >
          <Text style={[styles.navText, currentView === 'export' && styles.navTextActive]}>
            Export
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#667eea',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#667eea',
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  summaryCard: {
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
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  irsExplanation: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  trackingCard: {
    backgroundColor: 'white',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  subscriptionStatus: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  trackingActive: {
    alignItems: 'center',
  },
  trackingInactive: {
    alignItems: 'center',
  },
  trackingStatus: {
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  trackingNote: {
    fontSize: 12,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  featureHighlight: {
    backgroundColor: '#667eea',
    margin: 15,
    marginTop: 25,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  featureTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  featureSubtitle: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.9,
  },
  advantageText: {
    fontSize: 11,
    color: '#28a745',
    marginBottom: 15,
    textAlign: 'center',
  },
  bigStartButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 30,
    marginVertical: 10,
    minWidth: 280,
    alignItems: 'center',
  },
  bigButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 4,
  },
  bigButtonSubtext: {
    color: 'white',
    fontSize: 12,
    opacity: 0.9,
  },
  navigateButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  navigateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  navigateButtonSubtext: {
    color: 'white',
    fontSize: 12,
    opacity: 0.9,
    marginTop: 2,
  },
  trackingModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 25,
    padding: 4,
    marginBottom: 15,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#667eea',
  },
  modeButtonText: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  modeButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  autoStatus: {
    fontSize: 12,
    color: '#28a745',
    textAlign: 'center',
    marginBottom: 15,
    fontWeight: '500',
  },
  manualEntryButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  startButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  bigStopButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 30,
    marginVertical: 10,
    minWidth: 280,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  recentTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 15,
    marginBottom: 10,
  },
  tripsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  tripsTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  tripCard: {
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginBottom: 10,
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tripDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  tripRoute: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  tripDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tripDistance: {
    fontSize: 12,
    color: '#666',
  },
  tripCategory: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '500',
  },
  tripCost: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: '600',
  },
  tripActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  receiptButton: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 5,
    minWidth: 35,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  receiptButtonText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  mapButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    flex: 1,
    marginRight: 5,
  },
  mapButtonText: {
    color: 'white',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
  },
  navButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    flex: 1,
    marginLeft: 5,
  },
  navButtonText: {
    color: 'white',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
  },
  manualButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  manualButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  exportCard: {
    backgroundColor: 'white',
    margin: 15,
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exportTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
  },
  exportDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  exportButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    width: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    minWidth: 65,
  },
  categoryButtonActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  categoryButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  categoryButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    marginRight: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
  },
  saveButton: {
    flex: 1,
    padding: 12,
    marginLeft: 10,
    borderRadius: 8,
    backgroundColor: '#667eea',
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: Platform.OS === 'ios' ? 34 : 10,
    paddingTop: 8,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  navItemActive: {
    backgroundColor: '#f0f4ff',
  },
  navText: {
    fontSize: 14,
    color: '#666',
  },
  navTextActive: {
    color: '#667eea',
    fontWeight: '600',
  },
  presetButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    marginBottom: 10,
    gap: 8,
  },
  presetButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  presetButtonText: {
    color: '#667eea',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    numberOfLines: 1,
  },
  presetNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  modeExplanation: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  dateButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  receiptThumbnailContainer: {
    position: 'relative',
  },
  receiptThumbnail: {
    width: 30,
    height: 30,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  receiptCount: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#667eea',
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 16,
    textAlign: 'center',
  },
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#667eea',
  },
  mapCloseButton: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  mapTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  mapNavButton: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapDetails: {
    backgroundColor: 'white',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  mapTripInfo: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  mapTripData: {
    fontSize: 14,
    color: '#666',
  },
});
