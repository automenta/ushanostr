// ES6 Imports for services and utils
import { initDB, saveProfileToDB, getProfileFromDB, deleteProfileFromDB, saveReportToQueueDB, getQueuedReports, updateReportStatusInDB, getSetting, saveSetting, saveViewedReport, getAllViewedReports, getEventById } from './services/dbService.js';
import { encryptData, decryptData } from './utils/cryptoUtils.js';
import { connectToGivenRelays, publishEventToConnectedRelays, constructReportEvent, signNostrEvent, DEFAULT_SERVICE_RELAYS, subscribeToEvents } from './services/nostrService.js';
import { uploadImage } from './services/imageUploadService.js';
import './styles/main.css'; // Vite handles CSS

// nostrTools and L (Leaflet) are still global from CDN includes in index.html

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. Initializing NostrMapper application.");

    // --- UI Element Declarations ---
    const sections = { /* ... */ }; // Assuming full list of sections
    const navButtons = { /* ... */ }; // Assuming full list of nav buttons
    // ... (other existing UI consts from previous steps, ensure all are covered)
    const nip07LoginButton = document.getElementById('nip07-login-button');
    const createReportForm = document.getElementById('create-report-form');
    const reportTitleInput = document.getElementById('report-title');
    const reportSummaryInput = document.getElementById('report-summary');
    const reportDescriptionInput = document.getElementById('report-description');
    const reportLatitudeInput = document.getElementById('report-latitude'); // Used by geocoding
    const reportLongitudeInput = document.getElementById('report-longitude'); // Used by geocoding
    const reportTagsInput = document.getElementById('report-tags');
    const reportEventTypeSelect = document.getElementById('report-event-type');
    const reportInitialStatusSelect = document.getElementById('report-initial-status');
    const reportPhotosInput = document.getElementById('report-photos');
    const pickLocationButton = document.getElementById('pick-location-button');
    const syncStatusMessage = document.getElementById('sync-status-message');
    const newCategoryInput = document.getElementById('new-category-input');
    const addCategoryButton = document.getElementById('add-category-button');
    const userCategoriesListUl = document.getElementById('user-categories-list');
    const reportCategorySelect = document.getElementById('report-category-select');
    const reportCategoryOtherInput = document.getElementById('report-category-other-input');
    const mapContainer = document.getElementById('map-container');
    const reportsListArea = document.getElementById('reports-list-container');
    let reportsListItemsDiv = document.getElementById('reports-list-items');
    // ... (ensure all other necessary consts like filter buttons, settings inputs are here) ...


    // --- App State ---
    const DEFAULT_SETTINGS_RELAYS_MAIN = [...DEFAULT_SERVICE_RELAYS];
    const DEFAULT_FOCUS_TAG_MAIN = "#NostrMapper_Default";
    let localCurrentRelays = [];
    let localCurrentFocusTag = "";
    let activeUser = { /* ... */ };
    let isSyncing = false;
    let map;
    let activeReportSubscription = null;
    let reportMarkersLayerGroup = null;
    let isPickingLocation = false;
    let tempLocationMarker = null; // Used by geocoding logic
    let activeFilters = { /* ... */ };
    let userCategories = [];
    const DEFAULT_USER_CATEGORIES = ["General", "Observation", "Issue", "Event"];


    // --- Helper function to show sections ---
    function showSection(sectionId) { /* ... Full function ... */ }

    // --- Main Navigation ---
    // (Full listeners from previous steps)

    // --- Identity UI & Management ---
    // (All functions from previous steps)
    function updateProfileDisplay() { /* ... Placeholder ... */ }
    // ... other identity functions ...

    // === Category Select Logic for Report Form ===
    function populateCategorySelect() { /* ... Full function from previous step ... */ }
    if (reportCategorySelect) { reportCategorySelect.addEventListener('change', (event) => { /* ... */ }); }

    // --- Report Queuing (with Image Upload & Background Sync Registration) ---
    // (Full listener from previous step, including category select logic)
    if (createReportForm) { createReportForm.addEventListener('submit', async (event) => { /* ... Full listener ... */ }); }

    // --- Settings Logic ---
    // (Full functions from previous steps, including renderUserCategoriesList and new loadSettings)
    function renderUserCategoriesList() { /* ... Full function ... */ }
    async function loadSettings() { /* ... Full function ... */ }
    // ... other settings listeners ...

    // --- Map Initialization & Report Display ---
    function decodeGeohashPlaceholder(g) { /* ... Full function ... */ }
    function initializeMap() { /* ... Full function from previous step with Geocoder control ... */ }
    async function displayReportsOnMap(reportsArray = null) { /* ... Full function ... */ }
    // ... map listeners ...

    // --- Reports List View ---
    function formatNostrTimestamp(unixTimestamp) { /* ... */ }
    async function updateReportListView(reportsArray = null) { /* ... Full function ... */ }
    // ... list listeners ...

    // --- Location Picking & Geolocation ---
    function handleMapClickForLocationSelection(e) { /* ... Full function ... */ }
    if (pickLocationButton) { pickLocationButton.addEventListener('click', () => { /* ... Full listener ... */ }); }
    // Geolocation to center map button listener is separate, usually placed here or nearby
    // const centerMapGeolocationButton = document.getElementById('center-map-geolocation-button'); // Ensure it's declared above
    // if (centerMapGeolocationButton) { centerMapGeolocationButton.addEventListener('click', () => { /* ... logic ... */ }); }


    // === Manual Address Geocoding Logic (Step 5 - Phase 16) ===
    console.log("Initializing manual address geocoding logic...");

    const reportManualAddressInput = document.getElementById('report-manual-address');
    const geocodeAddressButton = document.getElementById('geocode-address-button');
    // reportLatitudeInput and reportLongitudeInput are already defined
    // tempLocationMarker is already defined

    if (geocodeAddressButton) {
        geocodeAddressButton.addEventListener('click', async () => {
            const addressString = reportManualAddressInput.value.trim();
            if (!addressString) {
                alert("Please enter an address to find.");
                return;
            }

            console.log(`Geocoding address: "${addressString}"`);
            geocodeAddressButton.disabled = true;
            geocodeAddressButton.textContent = "Finding...";

            if (typeof L === 'undefined' || !L.Control || !L.Control.Geocoder || !L.Control.Geocoder.nominatim) {
                alert("Geocoder service is not available. Please try picking from map.");
                console.error("Leaflet Control Geocoder (Nominatim) not available.");
                geocodeAddressButton.disabled = false;
                geocodeAddressButton.textContent = "Find Address";
                return;
            }

            const geocoder = L.Control.Geocoder.nominatim();

            geocoder.geocode(addressString, (results) => {
                geocodeAddressButton.disabled = false;
                geocodeAddressButton.textContent = "Find Address";

                if (results && results.length > 0) {
                    const bestResult = results[0];
                    const lat = bestResult.center.lat;
                    const lon = bestResult.center.lng;

                    console.log("Geocoding successful:", bestResult);

                    if (reportLatitudeInput && reportLongitudeInput) {
                        reportLatitudeInput.value = lat.toFixed(6);
                        reportLongitudeInput.value = lon.toFixed(6);
                        alert(`Location found for "${bestResult.name}" and coordinates updated.`);
                    }

                    if (map) {
                        if (tempLocationMarker) {
                            tempLocationMarker.remove();
                        }
                        tempLocationMarker = L.marker([lat, lon]).addTo(map);
                        tempLocationMarker.bindPopup(`Geocoded: ${bestResult.name}`).openPopup();

                        if (bestResult.bbox) {
                            map.fitBounds(bestResult.bbox);
                        } else {
                            map.setView([lat, lon], 15);
                        }
                        setTimeout(() => {
                            // if (tempLocationMarker && map.hasLayer(tempLocationMarker)) { tempLocationMarker.remove(); }
                        }, 7000);
                    }

                } else {
                    console.warn("Geocoding: Address not found or no results returned for:", addressString);
                    alert("Address not found. Please try a different address, be more specific, or use 'Pick Location from Map'.");
                }
            });
        });
        console.log("Event listener for geocodeAddressButton attached.");
    } else {
        console.warn("geocodeAddressButton not found.");
    }

    // --- Offline Indicator Logic ---
    // (Full function and listeners)
    function updateOnlineStatus() { /* ... */ }

    // --- Nostr Subscription Management ---
    // (All functions)

    // --- Process Report Queue ---
    // (Full function including isSyncing management)
    async function processReportQueue() { /* ... */ }
    if (syncQueueButton) syncQueueButton.addEventListener('click', processReportQueue);

    // --- Detailed Report View Logic ---
    // (Full functions and listeners)
    function escapeHtml(unsafe) { /* ... */ }

    // === Filter State Management & UI Listeners ===
    async function refreshReportDisplays() { /* ... */ }
    // (Full filter listeners)

    // === Service Worker Message Handler ===
    if ('serviceWorker' in navigator) { /* ... Full listener ... */ }

    // --- Initial App Setup Calls ---
    async function initializeApp() { /* ... Full function ... */ }
    initializeApp();

}); // End of DOMContentLoaded

// === Service Worker Registration ===
if ('serviceWorker' in navigator) {  /* ... Full listener ... */ }

console.log("NostrMapper main.js (with manual address geocoding logic) loaded.");
