// === src/main.js ===
// Main application logic, UI interactions, and service consumption.

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. Initializing UI logic in main.js.");

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

    function showSection(sectionId) {
        console.log(`Attempting to show section: ${sectionId}`);
        Object.values(sections).forEach(section => {
            if (section) section.classList.add('hidden');
        });
        if (sections.createProfileForm) sections.createProfileForm.classList.add('hidden');
        if (sections.importKeyForm) sections.importKeyForm.classList.add('hidden');

        if (sections[sectionId]) {
            sections[sectionId].classList.remove('hidden');
            console.log(`Section ${sectionId} shown.`);
        } else {
            console.warn(`Section ${sectionId} not found.`);
        }
    }

    if (navButtons.identity) navButtons.identity.addEventListener('click', () => showSection('identity'));
    // navButtons.map listener is defined with map init logic later
    if (navButtons.createReport) navButtons.createReport.addEventListener('click', () => showSection('createReport'));
    if (navButtons.settings) navButtons.settings.addEventListener('click', () => showSection('settings'));

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

    if (createProfileButton) createProfileButton.addEventListener('click', () => {
        sections.identity.classList.add('hidden');
        sections.createProfileForm.classList.remove('hidden');
    });
    if (cancelCreateProfileButton) cancelCreateProfileButton.addEventListener('click', () => {
        sections.createProfileForm.classList.add('hidden');
        sections.identity.classList.remove('hidden');
        if (generatedKeyInfoDiv) generatedKeyInfoDiv.classList.add('hidden');
    });
    if (importKeyButton) importKeyButton.addEventListener('click', () => {
        sections.identity.classList.add('hidden');
        sections.importKeyForm.classList.remove('hidden');
    });
    if (cancelImportKeyButton) cancelImportKeyButton.addEventListener('click', () => {
        sections.importKeyForm.classList.add('hidden');
        sections.identity.classList.remove('hidden');
    });

    async function loadAndDisplayProfile() {
        console.log("loadAndDisplayProfile called");
        try {
            const profile = await getProfileFromDB('localUser');
            if (profile && profile.pubkey) {
                const npub = nostrTools.nip19.npubEncode(profile.pubkey);
                let profileTypeDisplay = (profile.profileType === 'localImport') ? "(Local - Imported)" : "(Local)";
                profileInfoArea.innerHTML = `Current Profile ${profileTypeDisplay}: ${npub} <button id="logout-button" style="margin-left: 10px; padding: 5px 10px; background-color: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;">Logout</button>`;

                const logoutButton = document.getElementById('logout-button');
                if (logoutButton) logoutButton.addEventListener('click', handleLogout);
                if (signingTestArea) signingTestArea.classList.remove('hidden');
            } else {
                profileInfoArea.textContent = 'Current Profile: Not logged in.';
                if (signingTestArea) signingTestArea.classList.add('hidden');
            }
        } catch (error) {
            console.error("Error loading profile:", error);
            profileInfoArea.textContent = 'Current Profile: Error loading.';
            if (signingTestArea) signingTestArea.classList.add('hidden');
        }
    }

    async function handleLogout() {
        const confirmLogout = confirm("Are you sure you want to log out? This will remove your encrypted private key from this browser. Make sure you have backed up your private key (nsec)!");
        if (confirmLogout) {
            try {
                await deleteProfileFromDB('localUser');
                alert('You have been logged out. Your local key data has been cleared.');
                loadAndDisplayProfile();
                showSection('identity');
            } catch (error) {
                console.error('Error during logout:', error);
                alert('Failed to logout completely: ' + error.message);
            }
        }
    }

    if (generateKeysButton) {
        generateKeysButton.addEventListener('click', async () => {
            if (!createAckRisksCheckbox.checked) {
                alert('You must acknowledge the risks before generating keys.'); return;
            }
            const passphrase = createPassphraseInput.value;
            if (passphrase.length < 8) {
                alert('Passphrase must be at least 8 characters long.'); return;
            }
            try {
                const privateKeyHex = nostrTools.generatePrivateKey();
                const publicKeyHex = nostrTools.getPublicKey(privateKeyHex);
                const nsec = nostrTools.nip19.nsecEncode(privateKeyHex);
                const npub = nostrTools.nip19.npubEncode(publicKeyHex);
                generatedPublicKeyText.textContent = npub;
                generatedPrivateKeyTextarea.value = nsec;
                generatedKeyInfoDiv.classList.remove('hidden');
                const encryptedKeyData = await encryptData(privateKeyHex, passphrase);
                const profile = {
                    id: 'localUser', pubkey: publicKeyHex,
                    encryptedSalt: encryptedKeyData.salt, encryptedIv: encryptedKeyData.iv,
                    encryptedPrivateKey: encryptedKeyData.encryptedData, profileType: 'local'
                };
                await saveProfileToDB(profile);
                alert('Profile created and saved locally (encrypted)! IMPORTANT: Copy your private key (nsec) shown and back it up securely. It will not be shown again.');
                createPassphraseInput.value = '';
                loadAndDisplayProfile();
            } catch (error) {
                console.error('Error generating/saving keys:', error);
                alert('Failed to generate or save keys: ' + error.message);
            }
        });
    }
    if (copyPrivateKeyButton) {
        copyPrivateKeyButton.addEventListener('click', () => {
            generatedPrivateKeyTextarea.select();
            try {
                document.execCommand('copy');
                alert('Private key copied to clipboard! Store it safely.');
            } catch (err) {
                alert('Failed to copy private key. Please copy it manually.');
            }
            if (window.getSelection) window.getSelection().removeAllRanges();
            else if (document.selection) document.selection.empty();
        });
    }

    if (importKeySubmitButton) {
        importKeySubmitButton.addEventListener('click', async () => {
            if (!importAckRisksCheckbox.checked) {
                alert('You must acknowledge the EXTREME risks before importing a private key.'); return;
            }
            const privateKeyInput = importPrivateKeyTextarea.value.trim();
            const passphrase = importPassphraseInput.value;
            if (!privateKeyInput || passphrase.length < 8) {
                alert('Private key and a passphrase of at least 8 characters are required.'); return;
            }
            try {
                let privateKeyHex;
                if (privateKeyInput.startsWith('nsec')) {
                    const decoded = nostrTools.nip19.decode(privateKeyInput);
                    if (decoded.type !== 'nsec') throw new Error('Invalid nsec private key format.');
                    privateKeyHex = decoded.data;
                } else if (privateKeyInput.length === 64 && /^[a-f0-9]+$/.test(privateKeyInput)) {
                    privateKeyHex = privateKeyInput;
                } else {
                    throw new Error('Invalid private key format. Please use nsec or hex format.');
                }
                const publicKeyHex = nostrTools.getPublicKey(privateKeyHex);
                const npub = nostrTools.nip19.npubEncode(publicKeyHex);
                const encryptedKeyData = await encryptData(privateKeyHex, passphrase);
                const profile = {
                    id: 'localUser', pubkey: publicKeyHex,
                    encryptedSalt: encryptedKeyData.salt, encryptedIv: encryptedKeyData.iv,
                    encryptedPrivateKey: encryptedKeyData.encryptedData, profileType: 'localImport'
                };
                await saveProfileToDB(profile);
                alert('Private key imported, encrypted, and saved locally! Your public key (npub) is: ' + npub);
                importPrivateKeyTextarea.value = '';
                importPassphraseInput.value = '';
                importAckRisksCheckbox.checked = false;
                loadAndDisplayProfile();
                showSection('identity');
            } catch (error) {
                console.error('Error importing/saving key:', error);
                alert('Failed to import or save key: ' + error.message);
            }
        });
    }

    async function getDecryptedPrivateKeyForSigning() {
        const profile = await getProfileFromDB('localUser');
        if (!profile || !profile.encryptedPrivateKey) {
            alert('No local profile found.'); throw new Error('No local profile.');
        }
        const passphrase = prompt('Enter passphrase to decrypt private key for signing:');
        if (!passphrase) { alert('Passphrase not provided.'); throw new Error('Passphrase not provided.'); }
        try {
            const encryptedDetails = {
                salt: profile.encryptedSalt, iv: profile.encryptedIv,
                encryptedData: profile.encryptedPrivateKey
            };
            const decryptedHexKey = await decryptData(encryptedDetails, passphrase);
            console.log('Decrypted private key (hex) for signing:', decryptedHexKey);
            const publicKeyFromDecrypted = nostrTools.getPublicKey(decryptedHexKey);
            if (publicKeyFromDecrypted === profile.pubkey) {
                console.log("Verification successful: Derived public key matches stored public key.");
                alert('Private key decrypted successfully for signing (see console).');
            } else {
                console.error("CRITICAL ERROR: Derived public key does NOT match stored public key after decryption.");
                alert("CRITICAL ERROR: Public key verification failed after decryption. Check console.");
            }
            return decryptedHexKey;
        } catch (error) {
            console.error('Failed to get decrypted private key:', error);
            alert('Failed to decrypt private key: ' + error.message);
            throw error;
        }
    }
    if (testDecryptButton) {
        testDecryptButton.addEventListener('click', async () => {
            try { await getDecryptedPrivateKeyForSigning(); }
            catch (err) { console.log("Test decryption process ended with error or cancellation."); }
        });
    }

    // Report Form Elements
    const createReportForm = document.getElementById('create-report-form');
    const reportTitleInput = document.getElementById('report-title');
    const reportSummaryInput = document.getElementById('report-summary');
    const reportDescriptionInput = document.getElementById('report-description');
    const reportLatitudeInput = document.getElementById('report-latitude');
    const reportLongitudeInput = document.getElementById('report-longitude');
    // New form elements for Step 14b
    const reportTagsInput = document.getElementById('report-tags');
    const reportCategoryInput = document.getElementById('report-category');
    const reportEventTypeSelect = document.getElementById('report-event-type');
    const reportInitialStatusSelect = document.getElementById('report-initial-status');
    const reportPhotosInput = document.getElementById('report-photos');

    // Updated Report Queuing Logic (Step 14b)
    if (createReportForm) {
        createReportForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const title = reportTitleInput.value;
            const summary = reportSummaryInput.value;
            const description = reportDescriptionInput.value;
            const latitude = reportLatitudeInput.value;
            const longitude = reportLongitudeInput.value;
            const tags = reportTagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
            const category = reportCategoryInput.value.trim();
            const eventType = reportEventTypeSelect.value;
            const initialStatus = reportInitialStatusSelect.value;
            let photoInfo = [];
            if (reportPhotosInput.files.length > 0) {
                for (let i = 0; i < reportPhotosInput.files.length; i++) {
                    photoInfo.push({ name: reportPhotosInput.files[i].name, type: reportPhotosInput.files[i].type, size: reportPhotosInput.files[i].size });
                }
            }
            if (!title || !summary) {
                alert('Title and Summary are required.'); return;
            }
            const reportData = {
                title, summary, description, latitude, longitude,
                tags, category, eventType, initialStatus, photoInfo
            };
            try {
                const reportKey = await saveReportToQueueDB(reportData); // From dbService.js
                alert(`Report "${title}" (ID: ${reportKey}) queued with additional details!`);
                createReportForm.reset();
                reportPhotosInput.value = null;
            } catch (error) {
                console.error('Failed to queue report with additional details:', error);
                alert('Error queuing report: ' + error.message);
            }
        });
        console.log("Create report form event listener updated for additional fields.");
    } else {
        console.warn("Create report form not found. Cannot attach submit listener.");
    }

    // === Map Initialization Logic (Step 11) ===
    let map;
    function initializeMap() {
        const mapContainer = document.getElementById('map-container');
        if (!mapContainer) { console.error('Map container element not found.'); return; }
        if (typeof L === 'undefined') {
            console.error('Leaflet library (L) not found.');
            mapContainer.innerHTML = '<p style="color: red;">Error: Map library failed to load.</p>'; return;
        }
        if (map && mapContainer.offsetParent !== null) {
            map.invalidateSize(); return;
        }
        if (map) {
             setTimeout(() => { if (map) map.invalidateSize(); }, 100); return;
        }
        mapContainer.innerHTML = '';
        map = L.map('map-container').setView([20, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18,
        }).addTo(map);
        console.log('Leaflet Map initialized in map-container.');
        setTimeout(() => { if (map) map.invalidateSize(); }, 100);
    }
    if (navButtons.map) {
        const newMapButtonListener = () => {
            showSection('map');
            initializeMap();
        };
        navButtons.map.addEventListener('click', newMapButtonListener);
        // navButtons.map._clickHandler = newMapButtonListener; // Not strictly needed if DOMContentLoaded handles single init
        console.log("Map navigation button event listener updated to initialize map.");
    } else {
        console.warn("navButtons.map not found, cannot attach map initialization listener.");
    }

    // === Offline Indicator Logic (Step 13) ===
    const offlineIndicatorElement = document.getElementById('offline-indicator');
    function updateOnlineStatus() {
        if (navigator.onLine) {
            if (offlineIndicatorElement) {
                offlineIndicatorElement.textContent = 'Online';
                offlineIndicatorElement.style.backgroundColor = '#28a745';
                offlineIndicatorElement.style.color = 'white';
                offlineIndicatorElement.style.display = 'block';
                setTimeout(() => {
                    if (offlineIndicatorElement.textContent === 'Online') {
                         offlineIndicatorElement.style.display = 'none';
                    }
                }, 3000);
            }
        } else {
            if (offlineIndicatorElement) {
                offlineIndicatorElement.textContent = 'Offline';
                offlineIndicatorElement.style.backgroundColor = '#dc3545';
                offlineIndicatorElement.style.color = 'white';
                offlineIndicatorElement.style.display = 'block';
            }
        }
    }
    if (offlineIndicatorElement) {
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus();
    } else {
        console.warn("Offline indicator element not found.");
    }

    // --- Initial calls ---
    loadAndDisplayProfile();
    showSection('identity');


    // === Nostr Event Construction (Step 14c) ===
    // Placeholder for geohash functionality.
    // In a real implementation, you'd use a library like 'ngeohash'.
    function calculateGeohash(latitude, longitude, precision = 6) {
        if (latitude === null || longitude === null || isNaN(parseFloat(latitude)) || isNaN(parseFloat(longitude))) {
            return null; // No location, no geohash
        }
        // This is NOT a real geohash. Placeholder only.
        console.warn("Using placeholder geohash function. Replace with a real implementation.");
        return `placeholder_gh_${parseFloat(latitude).toFixed(2)}_${parseFloat(longitude).toFixed(2)}`;
    }

    async function constructReportEvent(reportData, authorPublicKeyHex) {
        console.log("Constructing Nostr event for report:", reportData);
        console.log("Using author pubkey:", authorPublicKeyHex);

        if (!authorPublicKeyHex) {
            throw new Error("Author public key is required to construct an event.");
        }

        const tags = [];
        const currentTime = Math.floor(Date.now() / 1000);

        // Geohash tag (using placeholder)
        if (reportData.latitude && reportData.longitude) {
            const geohash = calculateGeohash(parseFloat(reportData.latitude), parseFloat(reportData.longitude));
            if (geohash) {
                tags.push(["g", geohash]);
            }
        }

        // Category tags (NIP-32 style)
        if (reportData.category) {
            tags.push(["L", "report-category"]); // General label namespace
            tags.push(["l", reportData.category, "report-category"]);
        }

        // Deployment/Focus Tag (hardcoded for now) and other freeform tags
        const focusTag = "#NostrMapper_Default_Focus"; // Placeholder
        tags.push(["t", focusTag.startsWith('#') ? focusTag.substring(1) : focusTag]);

        if (reportData.tags && Array.isArray(reportData.tags)) {
            reportData.tags.forEach(tag => {
                // Ensure tags don't include '#' if they are just keywords,
                // or remove '#' if `nostr-tools` handles it.
                // For `t` tags, the value is usually the keyword itself without '#'.
                const tagName = tag.startsWith('#') ? tag.substring(1) : tag;
                if (tagName.toLowerCase() !== (focusTag.startsWith('#') ? focusTag.substring(1) : focusTag).toLowerCase()){ // Avoid duplicating focus tag
                     tags.push(["t", tagName]);
                }
            });
        }

        // Title and Summary
        if (reportData.title) {
            tags.push(["title", reportData.title]);
        }
        if (reportData.summary) {
            tags.push(["summary", reportData.summary]);
        }

        // Image tags (simplified placeholder)
        if (reportData.photoInfo && Array.isArray(reportData.photoInfo)) {
            reportData.photoInfo.forEach(photo => {
                // Using name as a placeholder for URL. Actual URL will come from upload service.
                tags.push(["image", photo.name || "uploaded_image_placeholder"]);
            });
        }

        // Event Type and Status
        if (reportData.eventType) {
            tags.push(["event_type", reportData.eventType]);
        }
        if (reportData.initialStatus) {
            tags.push(["status", reportData.initialStatus]);
        }

        const event = {
            kind: 30315,
            pubkey: authorPublicKeyHex,
            created_at: currentTime,
            tags: tags,
            content: reportData.description || reportData.summary || "" // Ensure content is not undefined
        };

        console.log("Constructed event object (unsigned):", event);
        return event;
    }
}); // End of DOMContentLoaded

// === Service Worker Registration ===
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        const swPath = 'sw.js';
        navigator.serviceWorker.register(swPath)
            .then(registration => {
                console.log('Service Worker registered successfully (new structure):', registration);
            })
            .catch(error => {
                console.error('Service Worker registration failed (new structure):', error);
            });
    });
} else {
    console.warn('Service Worker not supported in this browser.');
}

console.log("NostrMapper main.js loaded and executing (new structure).");
