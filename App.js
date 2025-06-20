const { useState, useEffect } = React;

// Main App Component
function App() {
    const [currentView, setCurrentView] = useState('dashboard');
    const [trips, setTrips] = useState([]);
    const [isTracking, setIsTracking] = useState(false);
    const [currentTrip, setCurrentTrip] = useState(null);
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const [userSubscription, setUserSubscription] = useState(null);

    useEffect(() => {
        // Initialize database and load trips
        DatabaseService.init();
        loadTrips();
        loadSubscription();
        
        // Check if there's an active trip
        const checkActiveTrip = async () => {
            try {
                const activeTrip = await DatabaseService.getActiveTrip();
                if (activeTrip) {
                    setCurrentTrip(activeTrip);
                    setIsTracking(true);
                    console.log('Restored active trip:', activeTrip);
                }
            } catch (error) {
                console.error('Error checking active trip:', error);
            }
        };
        
        checkActiveTrip();
        
        // Check for upgrade prompts after loading
        setTimeout(() => {
            if (subscriptionService.shouldShowUpgradePrompt()) {
                setShowSubscriptionModal(true);
                subscriptionService.markUpgradePromptShown();
            }
        }, 3000);
    }, []);

    const loadTrips = async () => {
        try {
            const tripData = await DatabaseService.getAllTrips();
            setTrips(tripData);
        } catch (error) {
            console.error('Error loading trips:', error);
        }
    };

    const loadSubscription = () => {
        const subscription = subscriptionService.getSubscription();
        setUserSubscription(subscription);
    };

    const startTracking = async () => {
        try {
            // Check subscription limits
            if (!subscriptionService.canCreateAutoTrip()) {
                setShowSubscriptionModal(true);
                return;
            }
            
            const trip = await TripService.startTrip();
            setCurrentTrip(trip);
            setIsTracking(true);
            
            // Record usage
            subscriptionService.recordAutoTrip();
            console.log('Trip started:', trip);
        } catch (error) {
            console.error('Error starting trip:', error);
            alert('Unable to start tracking. Please check location permissions.');
        }
    };

    const stopTracking = async () => {
        try {
            if (currentTrip) {
                await TripService.stopTrip(currentTrip.id);
                setCurrentTrip(null);
                setIsTracking(false);
                await loadTrips(); // Reload trips to show the completed trip
                console.log('Trip stopped');
            }
        } catch (error) {
            console.error('Error stopping trip:', error);
        }
    };

    const deleteTrip = async (tripId) => {
        try {
            await DatabaseService.deleteTrip(tripId);
            await loadTrips();
        } catch (error) {
            console.error('Error deleting trip:', error);
        }
    };

    const updateTrip = async (tripId, updates) => {
        try {
            await DatabaseService.updateTrip(tripId, updates);
            await loadTrips();
        } catch (error) {
            console.error('Error updating trip:', error);
        }
    };

    const renderCurrentView = () => {
        switch (currentView) {
            case 'dashboard':
                return React.createElement(Dashboard, {
                    trips,
                    isTracking,
                    currentTrip,
                    onStartTracking: startTracking,
                    onStopTracking: stopTracking
                });
            case 'trips':
                return React.createElement(TripList, {
                    trips,
                    onSelectTrip: (trip) => {
                        setSelectedTrip(trip);
                        setCurrentView('tripDetails');
                    },
                    onDeleteTrip: deleteTrip
                });
            case 'addTrip':
                return React.createElement(AddTrip, {
                    onTripAdded: () => {
                        loadTrips();
                        setCurrentView('trips');
                    },
                    onCancel: () => setCurrentView('trips')
                });
            case 'tripDetails':
                return React.createElement(TripDetails, {
                    trip: selectedTrip,
                    onUpdate: updateTrip,
                    onBack: () => setCurrentView('trips')
                });
            case 'reports':
                return React.createElement(Reports, { trips });
            case 'settings':
                return React.createElement(Settings, {});
            default:
                return React.createElement(Dashboard, {
                    trips,
                    isTracking,
                    currentTrip,
                    onStartTracking: startTracking,
                    onStopTracking: stopTracking
                });
        }
    };

    return React.createElement('div', { className: 'app-container' },
        // Navigation Header
        React.createElement('nav', { className: 'navbar navbar-dark bg-primary' },
            React.createElement('div', { className: 'container-fluid' },
                React.createElement('span', { className: 'navbar-brand mb-0 h1' },
                    React.createElement('i', { className: 'fas fa-route me-2' }),
                    'MileTracker Pro'
                ),
                React.createElement('div', { className: 'navbar-nav flex-row' },
                    isTracking && React.createElement('span', { 
                        className: 'nav-link text-warning fw-bold' 
                    },
                        React.createElement('i', { className: 'fas fa-circle blink me-1' }),
                        'TRACKING'
                    )
                )
            )
        ),

        // Main Content
        React.createElement('div', { className: 'main-content' },
            renderCurrentView()
        ),

        // Bottom Navigation
        React.createElement('nav', { className: 'bottom-nav' },
            React.createElement('div', { className: 'nav-buttons' },
                React.createElement('button', {
                    className: `nav-btn ${currentView === 'dashboard' ? 'active' : ''}`,
                    onClick: () => setCurrentView('dashboard')
                },
                    React.createElement('i', { className: 'fas fa-tachometer-alt' }),
                    React.createElement('span', {}, 'Dashboard')
                ),
                React.createElement('button', {
                    className: `nav-btn ${currentView === 'trips' ? 'active' : ''}`,
                    onClick: () => setCurrentView('trips')
                },
                    React.createElement('i', { className: 'fas fa-list' }),
                    React.createElement('span', {}, 'Trips')
                ),
                React.createElement('button', {
                    className: `nav-btn ${currentView === 'addTrip' ? 'active' : ''}`,
                    onClick: () => setCurrentView('addTrip')
                },
                    React.createElement('i', { className: 'fas fa-plus' }),
                    React.createElement('span', {}, 'Add Trip')
                ),
                React.createElement('button', {
                    className: `nav-btn ${currentView === 'reports' ? 'active' : ''}`,
                    onClick: () => setCurrentView('reports')
                },
                    React.createElement('i', { className: 'fas fa-chart-bar' }),
                    React.createElement('span', {}, 'Reports')
                ),
                React.createElement('button', {
                    className: `nav-btn ${currentView === 'settings' ? 'active' : ''}`,
                    onClick: () => setCurrentView('settings')
                },
                    React.createElement('i', { className: 'fas fa-cog' }),
                    React.createElement('span', {}, 'Settings')
                )
            )
        ),

        // Subscription Modal
        showSubscriptionModal && React.createElement(SubscriptionModal, {
            isOpen: showSubscriptionModal,
            onClose: () => setShowSubscriptionModal(false),
            onSubscribe: (planKey, planData) => {
                // Handle subscription logic
                console.log('Selected plan:', planKey, planData);
                
                if (planKey === 'free') {
                    setShowSubscriptionModal(false);
                    return;
                }
                
                // For demo purposes, simulate subscription success
                const result = subscriptionService.subscribe(planKey);
                if (result.success) {
                    loadSubscription();
                    setShowSubscriptionModal(false);
                    alert(`Successfully upgraded to ${planData.name}!`);
                }
            }
        })
    );
}

// Render the app using React 18 createRoot
const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(React.createElement(App));
