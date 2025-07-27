const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 6501;

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
    const downloadLink = `${req.protocol}://${req.get('host')}/file/${req.file.filename}`;
    res.send(`✅ File uploaded!<br><a href="${downloadLink}">${downloadLink}</a>`);
});

// Show upload form with CSS styling
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head>
          <title>My File Uploader</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #f9f9f9;
              padding: 50px;
              text-align: center;
            }
            form {
              background: white;
              padding: 20px;
              display: inline-block;
              border-radius: 8px;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            input[type="file"] {
              margin-bottom: 10px;
            }
            button {
              background-color: #007BFF;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 5px;
              cursor: pointer;
              font-size: 16px;
            }
            button:hover {
              background-color: #0056b3;
            }
            h2 {
              color: #333;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <h2>Upload a File</h2>
          <form action="/upload" method="post" enctype="multipart/form-data">
            <input type="file" name="file" required />
            <br />
            <button type="submit">Upload</button>
          </form>
        </body>
        </html>
    `);
});

// Serve uploaded files
app.use('/file', express.static(uploadFolder));

app.listen(PORT, () => {
    console.log(`🟢 File Uploader is running: http://localhost:${PORT}`);
});
