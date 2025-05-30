// ES6 Imports for services and utils
import { initDB, saveProfileToDB, getProfileFromDB, deleteProfileFromDB, saveReportToQueueDB, getQueuedReports, updateReportStatusInDB, getSetting, saveSetting } from './services/dbService.js';
import { encryptData, decryptData } from './utils/cryptoUtils.js';
import { connectToGivenRelays, publishEventToConnectedRelays, constructReportEvent, signNostrEvent, DEFAULT_SERVICE_RELAYS } from './services/nostrService.js';
import './styles/main.css'; // Vite handles CSS

// nostrTools and L (Leaflet) are still global from CDN includes in index.html

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. Initializing UI logic in main.js.");

    // --- UI Element Declarations ---
    const sections = {
        identity: document.getElementById('identity-section'),
        map: document.getElementById('map-section'),
        createReport: document.getElementById('create-report-section'),
        settings: document.getElementById('settings-section'),
        createProfileForm: document.getElementById('create-profile-form-section'),
        importKeyForm: document.getElementById('import-key-form-section')
    };
    const navButtons = {
        identity: document.getElementById('nav-identity'),
        map: document.getElementById('nav-map'),
        createReport: document.getElementById('nav-create-report'),
        settings: document.getElementById('nav-settings')
    };
    const createProfileButton = document.getElementById('create-profile-button');
    const cancelCreateProfileButton = document.getElementById('cancel-create-profile-button');
    const importKeyButton = document.getElementById('import-key-button');
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
    const profileInfoArea = document.getElementById('profile-info-area');
    const signingTestArea = document.getElementById('signing-test-area');
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
    const newRelayUrlInput = document.getElementById('new-relay-url');
    const addRelayButton = document.getElementById('add-relay-button');
    const relayListUl = document.getElementById('relay-list');
    const focusTagInput = document.getElementById('focus-tag-input');
    const setFocusTagButton = document.getElementById('set-focus-tag-button');
    const currentFocusTagDisplay = document.getElementById('current-focus-tag-display');
    const syncQueueButton = document.getElementById('sync-queue-button');
    const syncStatusMessage = document.getElementById('sync-status-message');
    const offlineIndicatorElement = document.getElementById('offline-indicator');

    // --- App State (Settings related) ---
    const DEFAULT_SETTINGS_RELAYS_MAIN = [...DEFAULT_SERVICE_RELAYS]; // Use a local copy for settings init
    const DEFAULT_FOCUS_TAG_MAIN = "#NostrMapper_Default";
    let localCurrentRelays = [];
    let localCurrentFocusTag = "";
    let isSyncing = false;
    let map; // Leaflet map instance

    // --- Helper function to show sections ---
    function showSection(sectionId) {
        Object.values(sections).forEach(section => {
            if (section) section.classList.add('hidden');
        });
        if (sections.createProfileForm) sections.createProfileForm.classList.add('hidden');
        if (sections.importKeyForm) sections.importKeyForm.classList.add('hidden');
        if (sections[sectionId]) {
            sections[sectionId].classList.remove('hidden');
        }
    }

    // --- Main Navigation ---
    if (navButtons.identity) navButtons.identity.addEventListener('click', () => showSection('identity'));
    if (navButtons.map) {
        const mapButtonListener = () => { showSection('map'); initializeMap(); };
        if (navButtons.map._clickHandler) navButtons.map.removeEventListener('click', navButtons.map._clickHandler);
        navButtons.map.addEventListener('click', mapButtonListener);
        navButtons.map._clickHandler = mapButtonListener;
    }
    if (navButtons.createReport) navButtons.createReport.addEventListener('click', () => showSection('createReport'));
    if (navButtons.settings) navButtons.settings.addEventListener('click', () => showSection('settings'));

    // --- Identity UI Toggles ---
    if (createProfileButton) createProfileButton.addEventListener('click', () => { sections.identity.classList.add('hidden'); sections.createProfileForm.classList.remove('hidden'); });
    if (cancelCreateProfileButton) cancelCreateProfileButton.addEventListener('click', () => { sections.createProfileForm.classList.add('hidden'); sections.identity.classList.remove('hidden'); if (generatedKeyInfoDiv) generatedKeyInfoDiv.classList.add('hidden'); });
    if (importKeyButton) importKeyButton.addEventListener('click', () => { sections.identity.classList.add('hidden'); sections.importKeyForm.classList.remove('hidden'); });
    if (cancelImportKeyButton) cancelImportKeyButton.addEventListener('click', () => { sections.importKeyForm.classList.add('hidden'); sections.identity.classList.remove('hidden'); });

    // --- Identity Management ---
    async function loadAndDisplayProfile() {
        try {
            const profile = await getProfileFromDB('localUser');
            if (profile && profile.pubkey) {
                const npub = nostrTools.nip19.npubEncode(profile.pubkey);
                let profileTypeDisplay = (profile.profileType === 'localImport') ? "(Imported)" : "(Local)";
                profileInfoArea.innerHTML = `Profile ${profileTypeDisplay}: ${npub} <button id="logout-button" style="margin-left:10px;padding:5px 10px;background-color:#dc3545;color:white;border:none;border-radius:3px;cursor:pointer;">Logout</button>`;
                document.getElementById('logout-button').addEventListener('click', handleLogout);
                if (signingTestArea) signingTestArea.classList.remove('hidden');
            } else {
                profileInfoArea.textContent = 'Profile: Not logged in.';
                if (signingTestArea) signingTestArea.classList.add('hidden');
            }
        } catch (error) { profileInfoArea.textContent = 'Profile: Error loading.'; if (signingTestArea) signingTestArea.classList.add('hidden');}
    }

    async function handleLogout() {
        if (confirm("Log out? This removes your key from browser. Ensure backup!")) {
            try {
                await deleteProfileFromDB('localUser');
                alert('Logged out. Key data cleared.');
                loadAndDisplayProfile(); showSection('identity');
            } catch (error) { alert('Logout failed: ' + error.message); }
        }
    }

    if (generateKeysButton) generateKeysButton.addEventListener('click', async () => {
        if (!createAckRisksCheckbox.checked) { alert('Acknowledge risks.'); return; }
        const passphrase = createPassphraseInput.value;
        if (passphrase.length < 8) { alert('Passphrase >= 8 chars.'); return; }
        try {
            const pkHex = nostrTools.generatePrivateKey();
            const pubHex = nostrTools.getPublicKey(pkHex);
            generatedPublicKeyText.textContent = nostrTools.nip19.npubEncode(pubHex);
            generatedPrivateKeyTextarea.value = nostrTools.nip19.nsecEncode(pkHex);
            generatedKeyInfoDiv.classList.remove('hidden');
            const encData = await encryptData(pkHex, passphrase); // from cryptoUtils
            await saveProfileToDB({ id: 'localUser', pubkey: pubHex, ...encData, profileType: 'local' });
            alert('Profile created & saved! BACKUP YOUR PRIVATE KEY (nsec).');
            createPassphraseInput.value = ''; loadAndDisplayProfile();
        } catch (error) { alert('Key generation/save error: ' + error.message); }
    });

    if (copyPrivateKeyButton) copyPrivateKeyButton.addEventListener('click', () => {
        generatedPrivateKeyTextarea.select();
        try { document.execCommand('copy'); alert('Private key copied!'); }
        catch (err) { alert('Copy failed.'); }
        if (window.getSelection) window.getSelection().removeAllRanges();
        else if (document.selection) document.selection.empty();
    });

    if (importKeySubmitButton) importKeySubmitButton.addEventListener('click', async () => {
        if (!importAckRisksCheckbox.checked) { alert('Acknowledge risks.'); return; }
        const pkInput = importPrivateKeyTextarea.value.trim();
        const passphrase = importPassphraseInput.value;
        if (!pkInput || passphrase.length < 8) { alert('Private key & passphrase >= 8 chars required.'); return; }
        try {
            let pkHex;
            if (pkInput.startsWith('nsec')) {
                const decoded = nostrTools.nip19.decode(pkInput);
                if (decoded.type !== 'nsec') throw new Error('Invalid nsec.');
                pkHex = decoded.data;
            } else if (pkInput.length === 64 && /^[a-f0-9]+$/.test(pkInput)) pkHex = pkInput;
            else throw new Error('Invalid key format.');
            const pubHex = nostrTools.getPublicKey(pkHex);
            const encData = await encryptData(pkHex, passphrase); // from cryptoUtils
            await saveProfileToDB({ id: 'localUser', pubkey: pubHex, ...encData, profileType: 'localImport' });
            alert('Key imported & saved! Public key (npub): ' + nostrTools.nip19.npubEncode(pubHex));
            importPrivateKeyTextarea.value = ''; importPassphraseInput.value = ''; importAckRisksCheckbox.checked = false;
            loadAndDisplayProfile(); showSection('identity');
        } catch (error) { alert('Key import error: ' + error.message); }
    });

    async function getDecryptedPrivateKeyForSigning() { // Stays in main.js due to prompt
        const profile = await getProfileFromDB('localUser');
        if (!profile || !profile.encryptedPrivateKey) { alert('No local profile.'); throw new Error('No local profile.'); }
        const passphrase = prompt('Enter passphrase for signing:');
        if (!passphrase) { alert('Passphrase needed.'); throw new Error('Passphrase needed.'); }
        try {
            const decKey = await decryptData({ salt: profile.encryptedSalt, iv: profile.encryptedIv, encryptedData: profile.encryptedPrivateKey }, passphrase); // from cryptoUtils
            if (nostrTools.getPublicKey(decKey) === profile.pubkey) alert('Key decrypted for signing (see console).');
            else throw new Error("Public key verification failed post-decryption.");
            console.log('Decrypted PK for signing:', decKey);
            return decKey;
        } catch (error) { alert('Decryption failed: ' + error.message); throw error; }
    }
    if (testDecryptButton) testDecryptButton.addEventListener('click', async () => { try { await getDecryptedPrivateKeyForSigning(); } catch (err) { console.log("Test decrypt ended."); } });

    // --- Report Queuing ---
    if (createReportForm) createReportForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const reportData = {
            title: reportTitleInput.value, summary: reportSummaryInput.value, description: reportDescriptionInput.value,
            latitude: reportLatitudeInput.value, longitude: reportLongitudeInput.value,
            tags: reportTagsInput.value.split(',').map(t => t.trim()).filter(t => t),
            category: reportCategoryInput.value.trim(), eventType: reportEventTypeSelect.value,
            initialStatus: reportInitialStatusSelect.value,
            photoInfo: Array.from(reportPhotosInput.files).map(f => ({ name: f.name, type: f.type, size: f.size }))
        };
        if (!reportData.title || !reportData.summary) { alert('Title & Summary required.'); return; }
        try {
            const key = await saveReportToQueueDB(reportData); // from dbService
            alert(`Report "${reportData.title}" (ID: ${key}) queued!`);
            createReportForm.reset(); reportPhotosInput.value = null;
        } catch (error) { alert('Error queuing report: ' + error.message); }
    });

    // --- Settings Logic ---
    function renderRelayList() {
        if (!relayListUl) return;
        relayListUl.innerHTML = '';
        localCurrentRelays.forEach(url => {
            const li = document.createElement('li'); li.textContent = url;
            const btn = document.createElement('button'); btn.textContent = 'Remove';
            btn.classList.add('remove-relay-button'); btn.dataset.url = url;
            li.appendChild(btn); relayListUl.appendChild(li);
        });
    }
    async function loadSettings() {
        let relays = await getSetting('relays');
        if (!relays || !Array.isArray(relays) || relays.length === 0) {
            relays = [...DEFAULT_SETTINGS_RELAYS_MAIN]; await saveSetting('relays', relays);
        }
        localCurrentRelays = relays; renderRelayList();
        let tag = await getSetting('focusTag');
        if (tag === undefined || tag === null || String(tag).trim() === "") {
            tag = DEFAULT_FOCUS_TAG_MAIN; await saveSetting('focusTag', tag);
        }
        localCurrentFocusTag = String(tag);
        if (currentFocusTagDisplay) currentFocusTagDisplay.textContent = localCurrentFocusTag;
        if (focusTagInput) focusTagInput.value = localCurrentFocusTag;
    }
    if (addRelayButton) addRelayButton.addEventListener('click', async () => {
        const url = newRelayUrlInput.value.trim();
        if (url.startsWith("wss://") && !localCurrentRelays.includes(url)) {
            localCurrentRelays.push(url); await saveSetting('relays', localCurrentRelays);
            renderRelayList(); newRelayUrlInput.value = '';
        } else if (localCurrentRelays.includes(url)) alert("Relay exists.");
        else alert("Invalid URL.");
    });
    if (relayListUl) relayListUl.addEventListener('click', async (e) => {
        if (e.target.classList.contains('remove-relay-button')) {
            const url = e.target.dataset.url;
            localCurrentRelays = localCurrentRelays.filter(r => r !== url);
            await saveSetting('relays', localCurrentRelays); renderRelayList();
        }
    });
    if (setFocusTagButton) setFocusTagButton.addEventListener('click', async () => {
        const tag = focusTagInput.value.trim();
        if (tag) {
            localCurrentFocusTag = tag; await saveSetting('focusTag', localCurrentFocusTag);
            if (currentFocusTagDisplay) currentFocusTagDisplay.textContent = localCurrentFocusTag;
            alert(`Focus tag: ${localCurrentFocusTag}`);
        } else alert("Tag empty.");
    });

    // --- Map Initialization ---
    function initializeMap() { /* ... as before ... */ }
    // (Assume initializeMap is here from Step 11)

    // --- Offline Indicator ---
    function updateOnlineStatus() { /* ... as before ... */ }
    // (Assume updateOnlineStatus and its listeners are here from Step 13)

    // --- Process Report Queue (using nostrService) ---
    async function processReportQueue() {
        if (isSyncing) { alert("Sync in progress."); return; }
        isSyncing = true; if (syncStatusMessage) syncStatusMessage.textContent = "Syncing...";
        try {
            const relaysToUse = localCurrentRelays.length > 0 ? localCurrentRelays : DEFAULT_SETTINGS_RELAYS_MAIN;
            const connected = await connectToGivenRelays(relaysToUse); // from nostrService
            if (connected.length === 0) {
                alert("No relays connected. Sync failed."); if (syncStatusMessage) syncStatusMessage.textContent = "Relay connection failed.";
                isSyncing = false; return;
            }
            const profile = await getProfileFromDB('localUser');
            if (!profile || !profile.pubkey) {
                alert("Profile needed."); if (syncStatusMessage) syncStatusMessage.textContent = "Profile needed.";
                isSyncing = false; return;
            }
            const reports = await getQueuedReports('queued');
            if (reports.length === 0) {
                alert("Queue empty."); if (syncStatusMessage) syncStatusMessage.textContent = "Queue empty.";
                isSyncing = false; return;
            }
            if (syncStatusMessage) syncStatusMessage.textContent = `Found ${reports.length} reports. Decrypting key...`;
            let pkHex;
            try { pkHex = await getDecryptedPrivateKeyForSigning(); }
            catch (e) { alert("Key decrypt failed: " + e.message); if (syncStatusMessage) syncStatusMessage.textContent = "Key decrypt failed."; isSyncing = false; return; }

            let successes = 0, failures = 0;
            for (const reportWithKey of reports) {
                const { key, ...reportData } = reportWithKey;
                if (syncStatusMessage) syncStatusMessage.textContent = `Processing ${reportData.title || key}...`;
                try {
                    const event = await constructReportEvent(reportData, profile.pubkey, localCurrentFocusTag || DEFAULT_FOCUS_TAG_MAIN); // from nostrService
                    const signed = await signNostrEvent(event, pkHex); // from nostrService
                    const outcome = await publishEventToConnectedRelays(signed); // from nostrService
                    let newStatus = outcome.successCount > 0 ? (outcome.failureCount === 0 ? 'published' : 'partially_published') : 'failed';
                    if (outcome.successCount > 0) successes++; else failures++;
                    await updateReportStatusInDB(key, newStatus, outcome);
                } catch (e) { failures++; await updateReportStatusInDB(key, 'failed', { error: e.message }); }
            }
            const finalMsg = `Sync done. ${successes} ok, ${failures} failed.`;
            alert(finalMsg); if (syncStatusMessage) syncStatusMessage.textContent = finalMsg;
        } catch (e) { alert("Sync error: " + e.message); if (syncStatusMessage) syncStatusMessage.textContent = "Sync error."; }
        finally { isSyncing = false; }
    }
    if (syncQueueButton) syncQueueButton.addEventListener('click', processReportQueue);

    // --- Initial App Setup Calls ---
    async function initializeApp() {
        await initDB(); // Ensure DB service is ready first
        await loadSettings();
        await loadAndDisplayProfile();
        showSection('identity');
        // Optionally connect to relays in background, or wait for user action (e.g. sync queue)
        // const relaysToConnect = localCurrentRelays.length > 0 ? localCurrentRelays : DEFAULT_SETTINGS_RELAYS_MAIN;
        // connectToGivenRelays(relaysToConnect).catch(err => console.warn("Initial background relay connection failed:", err));
    }
    initializeApp();

}); // End of DOMContentLoaded

// === Service Worker Registration ===
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        const swPath = '/sw.js';
        navigator.serviceWorker.register(swPath)
            .then(registration => console.log('SW registered (new):', registration))
            .catch(error => console.error('SW registration failed (new):', error));
    });
} else {
    console.warn('Service Worker not supported.');
}
console.log("NostrMapper main.js loaded and executing (refactored for services).");
