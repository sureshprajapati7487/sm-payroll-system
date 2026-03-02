// generate-ssl.js
// Generates a self-signed certificate and saves it to the `cert` folder.
// This ensures that the server (and browsers) use the same certificate 
// across restarts, minimizing browser security warnings.

const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

const CERT_DIR = path.join(__dirname, 'cert');
const KEY_PATH = path.join(CERT_DIR, 'server.key');
const CERT_PATH = path.join(CERT_DIR, 'server.crt');

function generateAndSaveCert() {
    console.log('🔑 Generating self-signed SSL certificate...');

    if (!fs.existsSync(CERT_DIR)) {
        fs.mkdirSync(CERT_DIR, { recursive: true });
    }

    // Generate keys
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01' + Date.now(); // random enough serial

    // Valid for 10 years
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

    const attrs = [
        { name: 'commonName', value: 'localhost' },
        { name: 'organizationName', value: 'SM Payroll System' },
        { name: 'organizationalUnitName', value: 'IT Department' }
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    cert.setExtensions([
        { name: 'basicConstraints', cA: true },
        {
            name: 'subjectAltName', altNames: [
                { type: 2, value: 'localhost' },
                { type: 2, value: '127.0.0.1' },
                { type: 7, ip: '127.0.0.1' }, // IP address type
                // You can add your local IP ranges here if needed
            ]
        },
        { name: 'keyUsage', keyCertSign: true, digitalSignature: true, nonRepudiation: true, keyEncipherment: true, dataEncipherment: true },
        { name: 'extKeyUsage', serverAuth: true, clientAuth: true }
    ]);

    // Sign certificate
    cert.sign(keys.privateKey, forge.md.sha256.create());

    // Export to PEM
    const pemKey = forge.pki.privateKeyToPem(keys.privateKey);
    const pemCert = forge.pki.certificateToPem(cert);

    // Save to disk
    fs.writeFileSync(KEY_PATH, pemKey);
    fs.writeFileSync(CERT_PATH, pemCert);

    console.log('✅ Certificate generated and saved to:');
    console.log(`   - Key:  ${KEY_PATH}`);
    console.log(`   - Cert: ${CERT_PATH}`);
    console.log('\n💡 Tip: To stop browser warnings on your local network,');
    console.log('   import `server.crt` into your OS "Trusted Root Certification Authorities" store.');

    return { key: pemKey, cert: pemCert };
}

// Allow running from CLI directly
if (require.main === module) {
    generateAndSaveCert();
}

module.exports = {
    generateAndSaveCert,
    KEY_PATH,
    CERT_PATH
};
