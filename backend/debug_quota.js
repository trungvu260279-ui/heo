const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'service-account.json');

async function debugQuota() {
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        console.error("error: service-account.json not found");
        return;
    }

    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_PATH,
        scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const drive = google.drive({ version: 'v3', auth });

    const PARENT_FOLDER_ID = '1BXJTg6bS3U6zi9X70Wg7bf-03ZC-9VbX';
    try {
        console.log(`--- Testing Access to Folder: ${PARENT_FOLDER_ID} ---`);
        const res = await drive.files.get({
            fileId: PARENT_FOLDER_ID,
            fields: 'id, name, capabilities',
        });
        console.log('Folder Info:', res.data);
        console.log('Can create files:', res.data.capabilities.canAddChildren);
        
        console.log("\n--- Listing Files in this Folder ---");
        const listRes = await drive.files.list({
            q: `'${PARENT_FOLDER_ID}' in parents`,
            fields: 'files(id, name)'
        });
        console.log('Files Found:', listRes.data.files);
    } catch (err) {
        console.error('Error: ' + err.message);
    }
}

debugQuota();
