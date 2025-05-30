// ES6 Imports for services and utils
import { initDB, saveProfileToDB, getProfileFromDB, deleteProfileFromDB, saveReportToQueueDB, getQueuedReports, updateReportStatusInDB, getSetting, saveSetting, saveViewedReport, getAllViewedReports } from './services/dbService.js';
import { encryptData, decryptData } from './utils/cryptoUtils.js';
import { connectToGivenRelays, publishEventToConnectedRelays, constructReportEvent, signNostrEvent, DEFAULT_SERVICE_RELAYS, subscribeToEvents } from './services/nostrService.js';
import { uploadImage } from './services/imageUploadService.js'; // Added
import './styles/main.css'; // Vite handles CSS

// nostrTools and L (Leaflet) are still global from CDN includes in index.html

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. Initializing NostrMapper application.");

    // --- UI Element Declarations (ensure all are listed from previous steps) ---
    const sections = {
        identity: document.getElementById('identity-section'), map: document.getElementById('map-section'),
        createReport: document.getElementById('create-report-section'), settings: document.getElementById('settings-section'),
        createProfileForm: document.getElementById('create-profile-form-section'), importKeyForm: document.getElementById('import-key-form-section')
    };
    const navButtons = {
        identity: document.getElementById('nav-identity'), map: document.getElementById('nav-map'),
        createReport: document.getElementById('nav-create-report'), settings: document.getElementById('nav-settings')
    };
    const nip07LoginButton = document.getElementById('nip07-login-button');
    const nip07StatusMessage = document.getElementById('nip07-status-message');
    const createProfileButton = document.getElementById('create-profile-button');
    const importKeyButton = document.getElementById('import-key-button');
    const profileInfoArea = document.getElementById('profile-info-area');
    const signingTestArea = document.getElementById('signing-test-area');
    const cancelCreateProfileButton = document.getElementById('cancel-create-profile-button');
    const cancelImportKeyButton = document.getElementById('cancel-import-key-button');
    const generateKeysButton = document.getElementById('generate-keys-button');
    const createAckRisksCheckbox = document.getElementById('create-ack-risks');
    const createPassphraseInput = document.getElementById('create-passphrase');
    const generatedPublicKeyText = document.getElementById('generated-public-key');
    const generatedPrivateKeyTextarea = document.getElementById('generated-private-key');
    const generatedKeyInfoDiv = document.getElementById('generated-key-info');
    const copyPrivateKeyButton = document.getElementById('copy-private-key-button');
    const importKeySubmitButton = document.getElementById('import-key-submit-button');
    const importAckRisksCheckbox = document.getElementById('import-ack-risks');
    const importPrivateKeyTextarea = document.getElementById('import-private-key');
    const importPassphraseInput = document.getElementById('import-passphrase');
    const testDecryptButton = document.getElementById('test-decrypt-button');
    const createReportForm = document.getElementById('create-report-form');
    const reportTitleInput = document.getElementById('report-title');
    const reportSummaryInput = document.getElementById('report-summary');
    const reportDescriptionInput = document.getElementById('report-description');
    const reportLatitudeInput = document.getElementById('report-latitude');
    const reportLongitudeInput = document.getElementById('report-longitude');
    const reportTagsInput = document.getElementById('report-tags');
    const reportCategoryInput = document.getElementById('report-category');
    const reportEventTypeSelect = document.getElementById('report-event-type');
    const reportInitialStatusSelect = document.getElementById('report-initial-status');
    const reportPhotosInput = document.getElementById('report-photos');
    const pickLocationButton = document.getElementById('pick-location-button');
    const newRelayUrlInput = document.getElementById('new-relay-url');
    const addRelayButton = document.getElementById('add-relay-button');
    const relayListUl = document.getElementById('relay-list');
    const focusTagInput = document.getElementById('focus-tag-input');
    const setFocusTagButton = document.getElementById('set-focus-tag-button');
    const currentFocusTagDisplay = document.getElementById('current-focus-tag-display');
    const syncQueueButton = document.getElementById('sync-queue-button');
    const syncStatusMessage = document.getElementById('sync-status-message');
    const offlineIndicatorElement = document.getElementById('offline-indicator');
    const reportsListArea = document.getElementById('reports-list-container');
    let reportsListItemsDiv = null;
    const centerMapGeolocationButton = document.getElementById('center-map-geolocation-button');
    let userLocationMarker = null;

    // --- App State ---
    const DEFAULT_SETTINGS_RELAYS_MAIN = [...DEFAULT_SERVICE_RELAYS];
    const DEFAULT_FOCUS_TAG_MAIN = "#NostrMapper_Default";
    let localCurrentRelays = [];
    let localCurrentFocusTag = "";
    let activeUser = { pubkey: null, type: 'none', profileType: null, encryptedSalt: null, encryptedIv: null, encryptedPrivateKey: null };
    let nip07DisconnectButton = null;
    let isSyncing = false;
    let map;
    let activeReportSubscription = null;
    let reportMarkersLayerGroup = null;
    let isPickingLocation = false;
    let tempLocationMarker = null;
    const mapContainer = document.getElementById('map-container');

    // --- Helper function to show sections ---
    function showSection(sectionId) { /* ... as in Step 4 (Phase 8) ... */ }

    // --- Main Navigation ---
    // ... (Listeners as in Step 4 (Phase 8)) ...

    // --- Identity UI & Management (NIP-07 & Local) ---
    function updateProfileDisplay() { /* ... as in Step 4 (Phase 8) ... */ }
    function checkForNip07() { /* ... as in Step 4 (Phase 8) ... */ }
    if(nip07LoginButton) nip07LoginButton.addEventListener('click', async () => { /* ... as in Step 4 (Phase 8) ... */ });
    function handleNip07Disconnect(){ /* ... as in Step 4 (Phase 8) ... */ }
    async function loadAndDisplayLocalProfile() { /* ... as in Step 4 (Phase 8) ... */ }
    async function masterLogoutHandler() { /* ... as in Step 4 (Phase 8) ... */ }
    if(generateKeysButton) generateKeysButton.addEventListener('click', async () => { /* ... as in Step 4 (Phase 8) ... */ });
    if(copyPrivateKeyButton) copyPrivateKeyButton.addEventListener('click', () => { /* ... as in Step 4 (Phase 8) ... */ });
    if(importKeySubmitButton) importKeySubmitButton.addEventListener('click', async () => { /* ... as in Step 4 (Phase 8) ... */ });
    async function getDecryptedPrivateKeyForSigning() { /* ... as in Step 4 (Phase 8) ... */ }
    if(testDecryptButton) testDecryptButton.addEventListener('click', async () => { /* ... as in Step 4 (Phase 8) ... */ });

    // --- Report Queuing (UPDATED with Image Upload) ---
    if (createReportForm) {
        createReportForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const queueButton = document.getElementById('queue-report-button');
            if (queueButton) queueButton.disabled = true;
            if (syncStatusMessage) syncStatusMessage.textContent = 'Processing report...';

            const title = reportTitleInput.value;
            const summary = reportSummaryInput.value;
            const description = reportDescriptionInput.value;
            const latitude = reportLatitudeInput.value;
            const longitude = reportLongitudeInput.value;
            const tags = reportTagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
            const category = reportCategoryInput.value.trim();
            const eventType = reportEventTypeSelect.value;
            const initialStatus = reportInitialStatusSelect.value;
            let processedPhotoInfo = [];

            if (reportPhotosInput.files.length > 0) {
                if (syncStatusMessage) syncStatusMessage.textContent = `Uploading ${reportPhotosInput.files.length} image(s)...`;
                const uploadPromises = Array.from(reportPhotosInput.files).map(file => uploadImage(file)); // from imageUploadService.js
                try {
                    const results = await Promise.all(uploadPromises);
                    results.forEach((result, index) => {
                        if (result && result.url) {
                            processedPhotoInfo.push({
                                url: result.url, type: result.mimeType || reportPhotosInput.files[index].type,
                                size: result.size || reportPhotosInput.files[index].size, sha256: result.sha256,
                                blurhash: result.blurhash, width: result.width, height: result.height,
                                originalName: reportPhotosInput.files[index].name
                            });
                        } else {
                            processedPhotoInfo.push({ originalName: reportPhotosInput.files[index].name, error: 'Upload failed or no URL.' });
                        }
                    });
                    if (syncStatusMessage) syncStatusMessage.textContent = 'Image uploads processed.';
                } catch (uploadError) {
                    alert("Some images may not have uploaded. Check console.");
                    if (syncStatusMessage) syncStatusMessage.textContent = 'Error during image uploads.';
                }
            }

            if (!title || !summary) {
                alert('Title and Summary are required.');
                if (queueButton) queueButton.disabled = false;
                if (syncStatusMessage) syncStatusMessage.textContent = '';
                return;
            }
            const reportData = {
                title, summary, description, latitude, longitude,
                tags, category, eventType, initialStatus,
                photoInfo: processedPhotoInfo
            };
            try {
                const reportKey = await saveReportToQueueDB(reportData);
                alert(`Report "${title}" (ID: ${reportKey}) queued! Includes ${processedPhotoInfo.filter(p=>p.url).length} image(s).`);
                createReportForm.reset(); reportPhotosInput.value = null;
                if (syncStatusMessage) syncStatusMessage.textContent = `Report queued (ID: ${reportKey}).`;
            } catch (error) {
                alert('Error queuing report: ' + error.message);
                if (syncStatusMessage) syncStatusMessage.textContent = 'Error queuing report.';
            } finally {
                 if (queueButton) queueButton.disabled = false;
            }
        });
        console.log("Create report form event listener updated for image uploads.");
    } else {
        console.warn("Create report form not found.");
    }

    // --- Settings Logic ---
    function renderRelayList() { /* ... as in Step 4 (Phase 5) ... */ }
    async function loadSettings() { /* ... as in Step 4 (Phase 5) ... */ }
    if (addRelayButton) addRelayButton.addEventListener('click', async () => { /* ... as in Step 4 (Phase 5), calls startOrUpdateReportSubscription ... */ });
    if (relayListUl) relayListUl.addEventListener('click', async (e) => { /* ... as in Step 4 (Phase 5), calls startOrUpdateReportSubscription ... */ });
    if (setFocusTagButton) setFocusTagButton.addEventListener('click', async () => { /* ... as in Step 4 (Phase 5), calls startOrUpdateReportSubscription ... */ });

    // --- Map Initialization & Display ---
    function initializeMap() { /* ... as in Step 8 (Phase 7) ... */ }
    function decodeGeohashPlaceholder(g) { /* ... as in Step 8 (Phase 7) ... */ }
    async function displayReportsOnMap() { /* ... as in Step 8 (Phase 7) ... */ }

    // --- Reports List View ---
    function formatNostrTimestamp(ts) { /* ... as in Step 8 (Phase 7) ... */ }
    async function updateReportListView() { /* ... as in Step 8 (Phase 7) ... */ }

    // --- Location Picking ---
    function handleMapClickForLocationSelection(e) { /* ... as in Step 9 (Phase 7) ... */ }
    if (pickLocationButton) pickLocationButton.addEventListener('click', () => { /* ... as in Step 9 (Phase 7) ... */ });

    // --- Geolocation to Center Map ---
    if (centerMapGeolocationButton) centerMapGeolocationButton.addEventListener('click', () => { /* ... as in Step 10 (Phase 7) ... */ });

    // --- Offline Indicator Logic ---
    function updateOnlineStatus() { /* ... as in Step 13 (Phase 5) ... */ }
    if (offlineIndicatorElement) { /* ... listeners and initial call from Step 13 (Phase 5) ... */ }

    // --- Nostr Subscription Management ---
    async function handleReportEvent(event, relayUrl) { /* ... as in Step 6c (Phase 7), calls displayReportsOnMap and updateReportListView ... */ }
    function handleReportEOSE(relayUrl) { /* ... as in Step 6c (Phase 7) ... */ }
    async function startOrUpdateReportSubscription() { /* ... as in Step 6c (Phase 7) ... */ }

    // --- Process Report Queue (NIP-07 Signing Integrated) ---
    async function processReportQueue() { /* ... as in Step 3 (Phase 8) ... */ }
    if (syncQueueButton) syncQueueButton.addEventListener('click', processReportQueue);

    // --- Initial App Setup ---
    async function initializeApp() {
        await initDB();
        await loadSettings();
        checkForNip07();
        await loadAndDisplayLocalProfile();
        showSection('identity');
        initializeMap();
        await updateReportListView();
        await startOrUpdateReportSubscription();
        const relaysToConnectOnInit = localCurrentRelays.length > 0 ? localCurrentRelays : DEFAULT_SETTINGS_RELAYS_MAIN;
        connectToGivenRelays(relaysToConnectOnInit).catch(err => console.warn("Initial bg relay connection error:", err));
    }
    initializeApp();

}); // End of DOMContentLoaded

// === Service Worker Registration ===
if ('serviceWorker' in navigator) { /* ... as before ... */ }
console.log("NostrMapper main.js (with image upload integration) loaded.");

// NOTE: Replace /* ... as before ... */ with actual full function bodies from previous steps.
// This is a directive for the AI to construct the full file.
// Specific functions to ensure are fully populated from their last correct state:
// showSection, all identity functions (loadAndDisplayProfile, handleLogout, generateKeys, copyKey, importKey, getDecryptedPrivateKey),
// renderRelayList, loadSettings, settings button listeners,
// initializeMap, decodeGeohashPlaceholder, displayReportsOnMap,
// formatNostrTimestamp, updateReportListView,
// handleMapClickForLocationSelection, pickLocationButton listener, centerMapGeolocationButton listener,
// updateOnlineStatus, offlineIndicatorElement listeners,
// handleReportEvent, handleReportEOSE, startOrUpdateReportSubscription,
// processReportQueue (older version, before NIP-07 signing - actually, it should be the NIP-07 signing version from Step 3 Phase 8)
// Service Worker Registration
// The NEW `createReportForm` listener is provided in this step.

// Correcting the placeholder comments for the AI's understanding:
// The functions like `loadAndDisplayProfile`, `handleLogout`, `generateKeysButton` listener, etc.,
// should be the versions *after* NIP-07 integration (Step 2 and 3 of Phase 8).
// The `processReportQueue` function should be the one from Step 3 of Phase 8 (with NIP-07 signing).
// All other helper functions should be their latest complete versions from prior steps.
// The NEW `createReportForm` listener provided in THIS subtask (Step 6, Phase 9) is the one to be used.
// It replaces the `createReportForm` listener from Step 14b (Phase 5).
// The `getDecryptedPrivateKeyForSigning` should be the one from Step 4 (Phase 8) that uses `activeUser`.
// All UI element `const` declarations from the top of `DOMContentLoaded` in Step 4 (Phase 8) should be present.
// The `initializeApp` function should be the one from Step 4 (Phase 8).
// The `navButtons.map` listener should be the one from Step 4 (Phase 8) that also calls `updateReportListView`.
// The `updateProfileDisplay` must be the full one from Step 4 (Phase 8).
// Essentially, take main.js as of end of Step 4 (Phase 8), add the new import, and replace the createReportForm listener.
