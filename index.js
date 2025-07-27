const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

// Create "uploads" folder if it doesn't exist
const uploadFolder = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder);
}

// Multer config
const storage = multer.diskStorage({
    destination: uploadFolder,
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, uuidv4() + ext);
    }
});

const upload = multer({ storage });

// Upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
    const downloadLink = `${req.protocol}://${req.hostname}:${PORT}/file/${req.file.filename}`;
    res.send(`✅ File uploaded!<br><a href="${downloadLink}">${downloadLink}</a>`);
});

// Show upload form
app.get('/', (req, res) => {
    res.send(`
        <h2>Upload a File</h2>
        <form action="/upload" method="post" enctype="multipart/form-data">
            <input type="file" name="file" />
            <button type="submit">Upload</button>
        </form>
    `);
});

// Serve uploaded files
app.use('/file', express.static(uploadFolder));

app.listen(PORT, () => {
    console.log(`🟢 File Uploader is running: http://localhost:${PORT}`);
});
