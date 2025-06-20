const express = require('express');
const path = require('path');
const app = express();

// Set port from environment or default to 5000
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// Middleware
app.use(express.json());
app.use(express.static('.'));

// API Routes for external integration
try {
    const apiRoutes = require('./src/api/routes');
    app.use('/api/v1', apiRoutes);
} catch (error) {
    console.warn('API routes not available:', error.message);
}

// Serve mobile app static files
app.use('/mobile', express.static('mobile-web-app'));

// Handle SPA routing - serve index.html for all routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/mobile', (req, res) => {
    res.sendFile(path.join(__dirname, 'mobile-web-app', 'index.html'));
});

app.get('/mobile/', (req, res) => {
    res.sendFile(path.join(__dirname, 'mobile-web-app', 'index.html'));
});

// Start server
app.listen(PORT, HOST, () => {
    console.log(`MileTracker Pro server running on http://${HOST}:${PORT}`);
    console.log('Open your browser and navigate to the application');
    console.log('The app simulates a mobile experience - resize your browser to mobile width for best experience');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM signal. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT signal. Shutting down gracefully...');
    process.exit(0);
});
