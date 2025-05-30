// === src/services/dbService.js ===

const DB_NAME = 'NostrMapperDB_New';
const STORE_PROFILE = 'userProfile';
const STORE_REPORTS_QUEUE = 'reportsQueue';
const STORE_APP_SETTINGS = 'appSettings';
const STORE_VIEWED_REPORTS = 'viewedReports'; // New store for fetched reports
let db;

export async function initDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            // console.log("DB already initialized."); // Less verbose
            return resolve(db);
        }
        // console.log(`Initializing DB: ${DB_NAME}`);
        const request = indexedDB.open(DB_NAME, 1);

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.errorCode);
            reject('Error opening DB: ' + event.target.errorCode);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            // console.log('IndexedDB opened successfully.');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            console.log('IndexedDB upgrade needed or new stores being created.');
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
                reportsStore.createIndex('status_idx', 'status', {unique: false});
            }

            if (!dbInstance.objectStoreNames.contains(STORE_APP_SETTINGS)) {
                console.log(`Creating object store: ${STORE_APP_SETTINGS}`);
                dbInstance.createObjectStore(STORE_APP_SETTINGS, { keyPath: 'id' });
            }

            if (!dbInstance.objectStoreNames.contains(STORE_VIEWED_REPORTS)) {
                console.log(`Creating object store: ${STORE_VIEWED_REPORTS}`);
                const viewedReportsStore = dbInstance.createObjectStore(STORE_VIEWED_REPORTS, { keyPath: 'id' });
                viewedReportsStore.createIndex('kind_idx', 'kind', { unique: false });
                viewedReportsStore.createIndex('pubkey_idx', 'pubkey', { unique: false }); // Different from profile pubkey, this is event author
                viewedReportsStore.createIndex('created_at_idx', 'created_at', { unique: false });
            }
            console.log('IndexedDB setup/upgrade complete for all stores.');
        };
    });
}

export async function saveProfileToDB(profileData) {
    // console.log("Saving profile to DB:", profileData);
    const currentDB = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = currentDB.transaction([STORE_PROFILE], 'readwrite');
        const store = transaction.objectStore(STORE_PROFILE);
        const request = store.put(profileData);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject('Error saving profile: ' + event.target.errorCode);
    });
}

export async function getProfileFromDB(id = 'localUser') {
    // console.log(`Getting profile from DB, id: ${id}`);
    const currentDB = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = currentDB.transaction([STORE_PROFILE], 'readonly');
        const store = transaction.objectStore(STORE_PROFILE);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject('Error fetching profile: ' + event.target.errorCode);
    });
}

export async function deleteProfileFromDB(id = 'localUser') {
    // console.log(`Deleting profile from DB, id: ${id}`);
    const currentDB = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = currentDB.transaction([STORE_PROFILE], 'readwrite');
        const store = transaction.objectStore(STORE_PROFILE);
        const request = store.delete(id);
        request.onsuccess = () => resolve(true);
        request.onerror = (event) => reject('Error deleting profile: ' + event.target.errorCode);
    });
}

export async function saveReportToQueueDB(reportData) {
    // console.log("Saving report to queue DB:", reportData);
    const currentDB = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = currentDB.transaction([STORE_REPORTS_QUEUE], 'readwrite');
        const store = transaction.objectStore(STORE_REPORTS_QUEUE);
        const fullReportData = { ...reportData, timestamp: Date.now(), status: 'queued' };
        const request = store.add(fullReportData);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject('Error saving report to queue: ' + event.target.errorCode);
    });
}

export async function getQueuedReports(status = 'queued') {
    // console.log(`Getting reports from queue with status: ${status}`);
    const currentDB = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = currentDB.transaction([STORE_REPORTS_QUEUE], 'readonly');
        const store = transaction.objectStore(STORE_REPORTS_QUEUE);
        const statusIndex = store.index('status_idx');

        const reportsWithKeys = [];
        const cursorRequest = statusIndex.openCursor(IDBKeyRange.only(status));
        cursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                reportsWithKeys.push({ key: cursor.primaryKey, ...cursor.value });
                cursor.continue();
            } else {
                resolve(reportsWithKeys);
            }
        };
        cursorRequest.onerror = (event) => reject('Error fetching queued reports with keys: ' + event.target.errorCode);
    });
}

export async function updateReportStatusInDB(reportKey, newStatus, publishInfo = null) {
    // console.log(`Updating report key ${reportKey} to status '${newStatus}'`);
    const currentDB = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = currentDB.transaction([STORE_REPORTS_QUEUE], 'readwrite');
        const store = transaction.objectStore(STORE_REPORTS_QUEUE);
        const getRequest = store.get(reportKey);
        getRequest.onsuccess = () => {
            const report = getRequest.result;
            if (report) {
                report.status = newStatus;
                if (publishInfo) {
                    report.lastPublishAttempt = Date.now();
                    report.publishResults = publishInfo;
                }
                const putRequest = store.put(report, reportKey);
                putRequest.onsuccess = () => resolve(putRequest.result);
                putRequest.onerror = (event) => reject(`Error updating report ${reportKey} status: ` + event.target.errorCode);
            } else {
                reject(`Report with key ${reportKey} not found.`);
            }
        };
        getRequest.onerror = (event) => reject(`Error fetching report ${reportKey} for update: ` + event.target.errorCode);
    });
}

export async function saveSetting(key, value) {
    // console.log(`Saving setting: ${key}`, value);
    const currentDB = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = currentDB.transaction([STORE_APP_SETTINGS], 'readwrite');
        const store = transaction.objectStore(STORE_APP_SETTINGS);
        const request = store.put({ id: key, value: value });
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(`Error saving setting ${key}: ` + event.target.errorCode);
    });
}

export async function getSetting(key) {
    // console.log(`Getting setting: ${key}`);
    const currentDB = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = currentDB.transaction([STORE_APP_SETTINGS], 'readonly');
        const store = transaction.objectStore(STORE_APP_SETTINGS);
        const request = store.get(key);
        request.onsuccess = () => {
            if (request.result) {
                resolve(request.result.value);
            } else {
                resolve(undefined);
            }
        };
        request.onerror = (event) => reject(`Error getting setting ${key}: ` + event.target.errorCode);
    });
}

export async function saveViewedReport(eventObject) {
    // console.log(`Attempting to save viewed report event ID: ${eventObject.id}`);
    if (!eventObject || !eventObject.id) {
        console.warn("saveViewedReport: Attempted to save an invalid event object.");
        return Promise.reject("Invalid event object for saving.");
    }
    const currentDB = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = currentDB.transaction([STORE_VIEWED_REPORTS], 'readwrite');
        const store = transaction.objectStore(STORE_VIEWED_REPORTS);
        const getRequest = store.get(eventObject.id);
        getRequest.onsuccess = () => {
            if (getRequest.result) {
                resolve({ eventId: eventObject.id, status: 'already_exists' });
            } else {
                const putRequest = store.put(eventObject);
                putRequest.onsuccess = () => resolve({ eventId: putRequest.result, status: 'saved' });
                putRequest.onerror = (event) => reject(`Error saving event ${eventObject.id}: ` + event.target.errorCode);
            }
        };
        getRequest.onerror = (event) => reject(`Error checking for existing event ${eventObject.id}: ` + event.target.errorCode);
    });
}

// Initialize DB when the service loads.
initDB().then(() => {
    console.log('dbService.js: DB initialized successfully on load.');
}).catch(error => {
    console.error('dbService.js: DB initialization on load failed:', error);
});


export async function getAllViewedReports() {
    console.log("Getting all reports from viewedReports store...");
    const currentDB = await initDB(); // initDB is already defined
    return new Promise((resolve, reject) => {
        const transaction = currentDB.transaction([STORE_VIEWED_REPORTS], 'readonly'); // STORE_VIEWED_REPORTS is defined
        const store = transaction.objectStore(STORE_VIEWED_REPORTS);
        const request = store.getAll(); // Gets all records from the object store

        request.onsuccess = () => {
            console.log(`Found ${request.result.length} viewed reports.`);
            resolve(request.result); // Returns an array of event objects
        };
        request.onerror = (event) => {
            console.error('Error fetching all viewed reports:', event.target.errorCode);
            reject('Error fetching all viewed reports: ' + event.target.errorCode);
        };
    });
}
