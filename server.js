const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid'); // For unique temp files

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
    const tempFile = `temp-${uuidv4()}.js`;

    try {
        // Write code to a temporary file
        await fs.writeFile(tempFile, code);

        // Execute the code with a timeout
        const execPromise = util.promisify(exec);
        const { stdout, stderr } = await execPromise(`node ${tempFile}`, { timeout: 5000 });

        // Return output
        res.json({ output: stderr || stdout });
    } catch (error) {
        res.json({ error: error.message });
    } finally {
        // Clean up
        try { await fs.unlink(tempFile); } catch (e) {}
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
