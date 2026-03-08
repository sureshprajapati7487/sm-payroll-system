/**
 * create-icons.js
 * Generates pwa-192x192.png, pwa-512x512.png, and apple-touch-icon.png
 * using only built-in Node.js modules (no external dependencies).
 *
 * Each icon is: dark gradient background (#0f172a → #1e1b4b) with "SM" text in gradient white-blue
 * Saved directly to /public/
 */

const fs = require('fs');
const path = require('path');

// ─── Minimal PNG Writer ───────────────────────────────────────────────────────
// We'll use the `canvas` API via a third-party if available, otherwise fallback to sharp
// First check what's available in node_modules

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

// Try to use sharp if available
let sharp;
try {
    sharp = require('sharp');
    console.log('✅ Using sharp for icon generation');
} catch {
    sharp = null;
}

// Try canvas
let createCanvas;
try {
    ({ createCanvas } = require('canvas'));
    console.log('✅ Using canvas for icon generation');
} catch {
    createCanvas = null;
}

async function generateIconWithCanvas(size, outputPath) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, size, size);
    bg.addColorStop(0, '#0f172a');
    bg.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = bg;

    // Rounded rect
    const radius = size * 0.22;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fill();

    // Glow effect
    const glow = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.45);
    glow.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
    glow.addColorStop(1, 'rgba(99, 102, 241, 0)');
    ctx.fillStyle = glow;
    ctx.fill();

    // Text gradient
    const fontSize = size * 0.38;
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textGrad = ctx.createLinearGradient(0, size * 0.3, 0, size * 0.7);
    textGrad.addColorStop(0, '#ffffff');
    textGrad.addColorStop(1, '#a5b4fc');
    ctx.fillStyle = textGrad;
    ctx.fillText('SM', size / 2, size / 2);

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ Created: ${outputPath} (${size}x${size})`);
}

async function generateIconsSVGFallback() {
    // Create an SVG and that's what we actually need — Vite PWA plugin can use SVG too
    // But we need actual PNG. Create a minimal valid PNG using raw bytes.

    // We'll create a simple colored PNG programmatically
    const { execSync } = require('child_process');

    // Use PowerShell to create PNG via .NET System.Drawing
    const psScript = `
Add-Type -AssemblyName System.Drawing
function Make-Icon {
    param([int]$size, [string]$outPath)
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.TextRenderingHint = 'AntiAlias'
    
    # Background
    $brush1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 15, 23, 42))
    $g.FillRectangle($brush1, 0, 0, $size, $size)
    
    # Overlay gradient approximation
    $brush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(80, 99, 102, 241))
    $g.FillEllipse($brush2, [int]($size*0.05), [int]($size*0.05), [int]($size*0.9), [int]($size*0.9))
    
    # Text
    $fontSize = [int]($size * 0.38)
    $font = New-Object System.Drawing.Font('Arial', $fontSize, [System.Drawing.FontStyle]::Bold)
    $brush3 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = 'Center'
    $sf.LineAlignment = 'Center'
    $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
    $g.DrawString('SM', $font, $brush3, $rect, $sf)
    
    $g.Dispose()
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created: $outPath"
}

Make-Icon -size 512 -outPath "${publicDir.replace(/\\/g, '\\\\')}\\\\pwa-512x512.png"
Make-Icon -size 192 -outPath "${publicDir.replace(/\\/g, '\\\\')}\\\\pwa-192x192.png"
Make-Icon -size 180 -outPath "${publicDir.replace(/\\/g, '\\\\')}\\\\apple-touch-icon.png"
Make-Icon -size 32  -outPath "${publicDir.replace(/\\/g, '\\\\')}\\\\favicon-32x32.png"
`;

    const tmpScript = path.join(__dirname, '_tmp_icon.ps1');
    fs.writeFileSync(tmpScript, psScript);

    try {
        execSync(`powershell -ExecutionPolicy Bypass -File "${tmpScript}"`, { stdio: 'inherit' });
        console.log('✅ Icons created via PowerShell!');
    } finally {
        if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript);
    }
}

async function main() {
    if (createCanvas) {
        const sizes = [
            { size: 512, name: 'pwa-512x512.png' },
            { size: 192, name: 'pwa-192x192.png' },
            { size: 180, name: 'apple-touch-icon.png' },
            { size: 32, name: 'favicon-32x32.png' },
        ];
        for (const { size, name } of sizes) {
            await generateIconWithCanvas(size, path.join(publicDir, name));
        }
    } else {
        console.log('canvas not available, using PowerShell fallback...');
        await generateIconsSVGFallback();
    }

    console.log('\n✅ All icons generated in /public/ folder');
}

main().catch(console.error);
