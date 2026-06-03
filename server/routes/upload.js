const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const BUCKET = process.env.AWS_S3_BUCKET_NAME || 'sm-payroll-receipts';

// Initialize S3 Client
const s3Config = {
    region: process.env.AWS_REGION || 'auto',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    }
};
if (process.env.AWS_ENDPOINT) s3Config.endpoint = process.env.AWS_ENDPOINT;

const s3 = new S3Client(s3Config);

// File type validation filter
const fileFilter = (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`File type ${file.mimetype} is not allowed. Permitted: JPEG, PNG, WebP, PDF`), false);
    }
};

// Configure Multer with private ACL — files are not publicly accessible
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: BUCKET,
        // No ACL set — bucket policy controls access (default private)
        metadata: (_req, file, cb) => cb(null, { fieldName: file.fieldname }),
        key: (_req, file, cb) => {
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            const ext = file.originalname.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
            cb(null, `receipts/${uniqueSuffix}.${ext}`);
        },
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter,
});

// Middleware to check if S3 is configured
const checkS3Config = (req, res, next) => {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !BUCKET) {
        return res.status(503).json({
            error: 'Cloud storage is not configured.',
            why: 'AWS credentials or bucket name missing from server/.env',
            fix: 'Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME in server/.env',
            fallback: true,
        });
    }
    next();
};

// POST /api/upload/receipt — stores file privately; returns the S3 object key (not a public URL)
router.post('/receipt', checkS3Config, upload.single('receipt'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        // Return the S3 key — callers use GET /api/upload/signed-url?key=... to download
        res.status(200).json({
            success: true,
            key: req.file.key,  // store this key in DB
        });
    } catch (e) {
        res.status(500).json({ error: e.message || 'File upload failed' });
    }
});

// GET /api/upload/signed-url?key=receipts/xxx.jpg
// Returns a pre-signed URL valid for 15 minutes for secure, time-limited download
router.get('/signed-url', checkS3Config, async (req, res) => {
    try {
        const { key } = req.query;
        if (!key || typeof key !== 'string') return res.status(400).json({ error: 'key query param required' });
        // Prevent path traversal — key must start with receipts/ or documents/
        if (!/^(receipts|documents)\/[a-zA-Z0-9._\-]+$/.test(key)) {
            return res.status(400).json({ error: 'Invalid key format' });
        }
        const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
        const url = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15 minutes
        res.json({ url, expiresIn: 900 });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Failed to generate signed URL' });
    }
});

module.exports = router;
