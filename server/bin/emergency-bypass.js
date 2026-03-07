/**
 * emergency-bypass.js
 * 
 * Run this script directly on the server if you lock yourself out
 * via IP Whitelisting restrictions.
 * 
 * Usage:
 * cd server
 * node bin/emergency-bypass.js
 */

const { IPRestriction, sequelize } = require('../database');

async function runBypass() {
    console.log('🚨 STARTING EMERGENCY IP RESTRICTION BYPASS...');

    try {
        // Authenticate database connection
        await sequelize.authenticate();
        console.log('✅ Connected to database.');

        // Fetch all current restrictions
        const restrictions = await IPRestriction.findAll();
        console.log(`Found ${restrictions.length} IP Restriction rules.`);

        if (restrictions.length === 0) {
            console.log('ℹ️ No IP restrictions are currently active.');
            process.exit(0);
        }

        // Disable whitelisting for all rules instead of deleting them outright
        // to preserve the historical IP list as reference.
        let updatedCount = 0;
        for (const rule of restrictions) {
            if (rule.isWhitelisted) {
                await rule.update({ isWhitelisted: false });
                updatedCount++;
            }
        }

        console.log(`\n✅ SUCCESSFULLY DISABLED ${updatedCount} ACTIVE IP WHITELIST RULES.`);
        console.log('🔓 The system is now globally accessible to any IP address.');
        console.log('\nYou may need to restart your node server (npm start) if it is caching the global state (it shouldn\'t, but just in case).');
        process.exit(0);

    } catch (error) {
        console.error('❌ FATAL ERROR DURING BYPASS:', error.message);
        console.error('Ensure database.sqlite is accessible and this script is run from the server/ directory.');
        process.exit(1);
    }
}

runBypass();
