// === src/services/nostrService.js ===
// Handles Nostr-specific logic like event construction, signing, relay connections, publishing.
// nostrTools is assumed to be global via CDN.

console.log("nostrService.js loading...");

// --- Relay Management ---
export const DEFAULT_SERVICE_RELAYS = [
    "wss://relay.damus.io",
    "wss://relay.snort.social",
    "wss://nostr.wine"
];
let connectedRelays = []; // Internal state for this service
let relayConnectPromises = {}; // Internal state

export async function connectToRelay(relayUrl) {
    if (typeof nostrTools === 'undefined' || typeof nostrTools.relayInit === 'undefined') {
        console.error("nostrTools or nostrTools.relayInit is not available.");
        throw new Error("nostrTools not loaded.");
    }
    const existingRelay = connectedRelays.find(r => r.url === relayUrl);
    if (existingRelay && existingRelay.status === 1) { // WebSocket.OPEN
        return existingRelay;
    }
    if (relayConnectPromises[relayUrl]) {
        return relayConnectPromises[relayUrl];
    }
    console.log(`nostrService: Attempting to connect to relay: ${relayUrl}`);
    const relay = nostrTools.relayInit(relayUrl);
    const connectPromise = new Promise((resolve, reject) => {
        relay.on('connect', () => {
            console.log(`nostrService: Connected to ${relay.url}`);
            if (!connectedRelays.find(r => r.url === relay.url)) {
                connectedRelays.push(relay);
            }
            delete relayConnectPromises[relayUrl];
            resolve(relay);
        });
        relay.on('error', (err) => {
            console.error(`nostrService: Failed to connect to ${relay.url}:`, err);
            connectedRelays = connectedRelays.filter(r => r.url !== relay.url);
            delete relayConnectPromises[relayUrl];
            reject(new Error(`Failed to connect to ${relay.url}`));
        });
        relay.on('disconnect', () => {
            console.log(`nostrService: Disconnected from ${relay.url}`);
            connectedRelays = connectedRelays.filter(r => r.url !== relay.url);
        });
    });
    relayConnectPromises[relayUrl] = connectPromise;
    try {
        await relay.connect();
    } catch (error) {
        console.error(`nostrService: Direct call to relay.connect() failed for ${relayUrl}:`, error);
        delete relayConnectPromises[relayUrl];
        throw error;
    }
    return connectPromise;
}

export async function connectToGivenRelays(relaysArray) {
    console.log("nostrService: Connecting to given relays:", relaysArray);
    if (!relaysArray || relaysArray.length === 0) {
        console.warn("nostrService: No relays provided to connect to.");
        return connectedRelays.filter(r => r.status === 1);
    }
    const connectionPromises = relaysArray.map(url => connectToRelay(url).catch(e => {
        console.error(`nostrService: Error connecting to ${url} in connectToGivenRelays:`, e.message);
        return null;
    }));
    await Promise.all(connectionPromises);
    const currentConnected = connectedRelays.filter(r => r.status === 1);
    console.log(`nostrService: ${currentConnected.length} relays currently managed and connected by service.`);
    return currentConnected;
}

export async function publishEventToConnectedRelays(signedEvent) {
    if (!signedEvent || !signedEvent.id || !signedEvent.sig) {
        console.error("nostrService: A valid signed event is required for publishing.");
        return { successCount: 0, failureCount: 0, results: [], error: "Invalid event." };
    }
    const activeRelays = connectedRelays.filter(r => r.status === 1);
    if (activeRelays.length === 0) {
        console.warn("nostrService: No connected relays to publish to.");
        return { successCount: 0, failureCount: 0, results: [], error: "No connected relays." };
    }
    console.log(`nostrService: Publishing event ${signedEvent.id} to ${activeRelays.length} relays.`);
    let successCount = 0;
    let failureCount = 0;
    const results = [];
    const publishPromises = activeRelays.map(async relay => {
        try {
            let pub = relay.publish(signedEvent);
            await new Promise((resolve, reject) => {
                let handled = false;
                pub.on('ok', () => {
                    if (handled) return; handled = true; successCount++;
                    results.push({ relay: relay.url, status: 'ok' }); resolve();
                });
                pub.on('failed', (reason) => {
                    if (handled) return; handled = true; failureCount++;
                    results.push({ relay: relay.url, status: 'failed', reason: reason }); resolve();
                });
                setTimeout(() => {
                    if (handled) return; handled = true; failureCount++;
                    results.push({ relay: relay.url, status: 'timeout' }); resolve();
                }, 5000);
            });
        } catch (error) {
            failureCount++;
            results.push({ relay: relay.url, status: 'error', reason: error.message });
        }
    });
    await Promise.all(publishPromises);
    console.log(`nostrService: Publishing complete. Successes: ${successCount}, Failures: ${failureCount}`);
    return { successCount, failureCount, results };
}

function calculateGeohash(latitude, longitude, precision = 6) {
    if (latitude === null || longitude === null || isNaN(parseFloat(latitude)) || isNaN(parseFloat(longitude))) return null;
    console.warn("nostrService: Using placeholder geohash function.");
    return `placeholder_gh_${parseFloat(latitude).toFixed(2)}_${parseFloat(longitude).toFixed(2)}`;
}

export async function constructReportEvent(reportData, authorPublicKeyHex, focusTagString) {
    console.log("nostrService: Constructing Nostr event for report:", reportData);
    if (!authorPublicKeyHex) throw new Error("Author public key is required.");
    if (focusTagString === undefined || focusTagString === null) throw new Error("Focus tag string is required (can be empty string).");

    const tags = [];
    const currentTime = Math.floor(Date.now() / 1000);
    if (reportData.latitude && reportData.longitude) {
        const geohash = calculateGeohash(parseFloat(reportData.latitude), parseFloat(reportData.longitude));
        if (geohash) tags.push(["g", geohash]);
    }
    if (reportData.category) {
        tags.push(["L", "report-category"]);
        tags.push(["l", reportData.category, "report-category"]);
    }

    const fTag = focusTagString.startsWith('#') ? focusTagString.substring(1) : focusTagString;
    if (fTag) { // Only add non-empty focus tags
        tags.push(["t", fTag]);
    }

    if (reportData.tags && Array.isArray(reportData.tags)) {
        reportData.tags.forEach(tag => {
            const tagName = tag.startsWith('#') ? tag.substring(1) : tag;
            if (tagName && tagName.toLowerCase() !== fTag.toLowerCase()) tags.push(["t", tagName]);
        });
    }
    if (reportData.title) tags.push(["title", reportData.title]);
    if (reportData.summary) tags.push(["summary", reportData.summary]);
    if (reportData.photoInfo && Array.isArray(reportData.photoInfo)) {
        reportData.photoInfo.forEach(photo => tags.push(["image", photo.name || "uploaded_image_placeholder"]));
    }
    if (reportData.eventType) tags.push(["event_type", reportData.eventType]);
    if (reportData.initialStatus) tags.push(["status", reportData.initialStatus]);

    const event = {
        kind: 30315, pubkey: authorPublicKeyHex, created_at: currentTime,
        tags: tags, content: reportData.description || reportData.summary || ""
    };
    console.log("nostrService: Constructed event object (unsigned):", event);
    return event;
}

export async function signNostrEvent(eventTemplate, decryptedPrivateKeyHex) {
    console.log("nostrService: Attempting to sign event template:", eventTemplate);
    if (!decryptedPrivateKeyHex) throw new Error("Decrypted private key is required.");
    if (!eventTemplate || typeof eventTemplate.kind !== 'number') throw new Error("Valid event template required.");
    try {
        if (!eventTemplate.pubkey) eventTemplate.pubkey = nostrTools.getPublicKey(decryptedPrivateKeyHex);
        if (!eventTemplate.created_at) eventTemplate.created_at = Math.floor(Date.now() / 1000);
        const signedEvent = nostrTools.finalizeEvent(eventTemplate, decryptedPrivateKeyHex);
        console.log("nostrService: Event signed successfully:", signedEvent);
        return signedEvent;
    } catch (error) {
        console.error("nostrService: Error signing Nostr event:", error);
        throw new Error("Failed to sign event: " + error.message);
    }
}

console.log("nostrService.js loaded.");
