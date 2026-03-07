const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
require('dotenv').config();

// Initialize S3 Client
const s3Config = {
    region: process.env.AWS_REGION || 'auto', // 'auto' is useful for Cloudflare R2
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
};

// If using Cloudflare R2 or custom endpoint
if (process.env.AWS_ENDPOINT) {
    s3Config.endpoint = process.env.AWS_ENDPOINT;
}

const s3 = new S3Client(s3Config);

// Configure Multer to use S3
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_S3_BUCKET_NAME || 'sm-payroll-receipts',
        acl: 'public-read', // Ensure bucket allows public read if URLs are to be accessed directly
        metadata: function (req, file, cb) {
            cb(null, { fieldName: file.fieldname });
        },
        key: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = file.originalname.split('.').pop();
            cb(null, `receipts/${uniqueSuffix}.${ext}`);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware to check if S3 is configured
const checkS3Config = (req, res, next) => {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET_NAME) {
        return res.status(500).json({
            error: 'Cloud storage is not configured properly.',
            why: 'AWS credentials or Bucket name is missing in the .env file.',
            fix: 'Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME in server/.env',
            fallback: true // Tell frontend it can proceed without receipt if needed
        });
    }
    next();
};

// POST /api/upload/receipt
router.post('/receipt', checkS3Config, upload.single('receipt'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        // multer-s3 attaches the public URL to req.file.location
        res.status(200).json({
            success: true,
            url: req.file.location,
            key: req.file.key
        });
    } catch (e) {
        res.status(500).json({ error: e.message || 'File upload failed' });
    }
});

module.exports = router;
