const { sequelize, Employee } = require('./database');
const bcrypt = require('bcrypt');

async function resetSuperAdmin() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // Find all super admins
        const superAdmins = await Employee.findAll({ where: { role: 'SUPER_ADMIN' } });

        if (superAdmins.length === 0) {
            console.log('No super admins found in the database!');
            process.exit(0);
        }

        console.log('Found Super Admins:');
        const newPassword = 'admin'; // Short password for easy typing
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        for (const admin of superAdmins) {
            console.log(`- Name: ${admin.name} | Login ID (Employee ID): ${admin.id}`);

            // Overwrite password
            admin.password = hashedPassword;
            await admin.save();
        }

        console.log(`\nSUCCESS! All Super Admin passwords have been reset to: ${newPassword}`);
        console.log('Please login using any of the Login IDs above and the new password.');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

resetSuperAdmin();
