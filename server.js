const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint to run code
app.post('/run', async (req, res) => {
    const { code } = req.body;
    try {
        // Write code to a temporary file
        await fs.writeFile('temp.js', code);
        
        // Execute the code
        const execPromise = util.promisify(exec);
        const { stdout, stderr } = await execPromise('node temp.js');
        
        // Return output
        res.send(stderr || stdout);
    } catch (error) {
        res.status(500).send(error.message);
    } finally {
        // Clean up
        try { await fs.unlink('temp.js'); } catch (e) {}
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
