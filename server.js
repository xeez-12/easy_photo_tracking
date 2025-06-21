const express = require('express');
const path = require('path');
const app = express();

// Serve static files for assets (e.g., CSS, JS, images)
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Explicit route for index.html
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Redirect all other routes to the root (index.html)
app.get('*', (req, res) => {
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
