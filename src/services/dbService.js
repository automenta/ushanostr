// === src/services/dbService.js ===
// For now, functions are global or within a simple namespace if preferred,
// assuming this file is loaded before scripts that use these functions.
// True modularity with import/export will come with a build system.

console.log("dbService.js loading...");

const DB_NAME = 'NostrMapperDB_New'; // New name to avoid conflict during transition if any old DB exists
const STORE_PROFILE = 'userProfile';
const STORE_REPORTS_QUEUE = 'reportsQueue';
let db; // Global db instance for this service

async function initDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            console.log("DB already initialized.");
            return resolve(db);
        }
        console.log(`Initializing DB: ${DB_NAME}`);
        const request = indexedDB.open(DB_NAME, 1); // Version 1

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.errorCode);
            reject('Error opening DB: ' + event.target.errorCode);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('IndexedDB opened successfully.');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            console.log('IndexedDB upgrade needed.');
            const dbInstance = event.target.result;

            if (!dbInstance.objectStoreNames.contains(STORE_PROFILE)) {
                console.log(`Creating object store: ${STORE_PROFILE}`);
                const profileStore = dbInstance.createObjectStore(STORE_PROFILE, { keyPath: 'id' });
                profileStore.createIndex('pubkey_idx', 'pubkey', { unique: true });
            }

            if (!dbInstance.objectStoreNames.contains(STORE_REPORTS_QUEUE)) {
                console.log(`Creating object store: ${STORE_REPORTS_QUEUE}`);
                const reportsStore = dbInstance.createObjectStore(STORE_REPORTS_QUEUE, { autoIncrement: true });
                reportsStore.createIndex('timestamp_idx', 'timestamp', { unique: false });
                reportsStore.createIndex('status_idx', 'status', {unique: false}); // Added status index
            }
            console.log('IndexedDB setup/upgrade complete for all stores.');
        };
    });
}

async function saveProfileToDB(profileData) {
    console.log("Saving profile to DB:", profileData);
    const currentDB = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = currentDB.transaction([STORE_PROFILE], 'readwrite');
        const store = transaction.objectStore(STORE_PROFILE);
        const request = store.put(profileData);
        request.onsuccess = () => {
            console.log("Profile saved successfully, key:", request.result);
            resolve(request.result);
        };
        request.onerror = (event) => {
            console.error('Error saving profile:', event.target.errorCode);
            reject('Error saving profile: ' + event.target.errorCode);
        };
    });
}

async function getProfileFromDB(id = 'localUser') {
    console.log(`Getting profile from DB, id: ${id}`);
    const currentDB = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = currentDB.transaction([STORE_PROFILE], 'readonly');
        const store = transaction.objectStore(STORE_PROFILE);
        const request = store.get(id);
        request.onsuccess = () => {
            console.log("Profile fetched successfully:", request.result);
            resolve(request.result);
        };
        request.onerror = (event) => {
            console.error('Error fetching profile:', event.target.errorCode);
            reject('Error fetching profile: ' + event.target.errorCode);
        };
    });
}

async function deleteProfileFromDB(id = 'localUser') {
    console.log(`Deleting profile from DB, id: ${id}`);
    const currentDB = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = currentDB.transaction([STORE_PROFILE], 'readwrite');
        const store = transaction.objectStore(STORE_PROFILE);
        const request = store.delete(id);
        request.onsuccess = () => {
            console.log("Profile deleted successfully or was not found.");
            resolve(true);
        };
        request.onerror = (event) => {
            console.error('Error deleting profile:', event.target.errorCode);
            reject('Error deleting profile: ' + event.target.errorCode);
        };
    });
}

async function saveReportToQueueDB(reportData) {
    console.log("Saving report to queue DB:", reportData);
    const currentDB = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = currentDB.transaction([STORE_REPORTS_QUEUE], 'readwrite');
        const store = transaction.objectStore(STORE_REPORTS_QUEUE);
        const fullReportData = { ...reportData, timestamp: Date.now(), status: 'queued' };
        const request = store.add(fullReportData);
        request.onsuccess = () => {
            console.log("Report saved to queue successfully, key:", request.result);
            resolve(request.result);
        };
        request.onerror = (event) => {
            console.error('Error saving report to queue:', event.target.errorCode);
            reject('Error saving report to queue: ' + event.target.errorCode);
        };
    });
}

// Optional: Immediately attempt to initialize the DB when this script loads
// This helps ensure the DB is ready early.
initDB().then(() => {
    console.log('dbService.js: DB initialized on load.');
}).catch(error => {
    console.error('dbService.js: DB initialization on load failed:', error);
});

console.log("dbService.js loaded.");
