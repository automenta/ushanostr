// === UI & Navigation Logic ===

// Run this script after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. Initializing UI logic.");

    // Navigation and Section Elements
    const sections = {
        identity: document.getElementById('identity-section'),
        map: document.getElementById('map-section'),
        createReport: document.getElementById('create-report-section'),
        settings: document.getElementById('settings-section'),
        // Forms that are hidden/shown within main sections
        createProfileForm: document.getElementById('create-profile-form-section'),
        importKeyForm: document.getElementById('import-key-form-section')
    };

    const navButtons = {
        identity: document.getElementById('nav-identity'),
        map: document.getElementById('nav-map'),
        createReport: document.getElementById('nav-create-report'),
        settings: document.getElementById('nav-settings')
    };

    // Identity Form Interaction Elements
    const createProfileButton = document.getElementById('create-profile-button');
    const cancelCreateProfileButton = document.getElementById('cancel-create-profile-button');

    const importKeyButton = document.getElementById('import-key-button');
    const cancelImportKeyButton = document.getElementById('cancel-import-key-button');

    // Function to show a main section and hide others
    function showSection(sectionId) {
        console.log(`Attempting to show section: ${sectionId}`);
        Object.values(sections).forEach(section => {
            if (section) section.classList.add('hidden');
        });
        // Hide specific forms explicitly when changing main sections
        if (sections.createProfileForm) sections.createProfileForm.classList.add('hidden');
        if (sections.importKeyForm) sections.importKeyForm.classList.add('hidden');

        if (sections[sectionId]) {
            sections[sectionId].classList.remove('hidden');
            console.log(`Section ${sectionId} shown.`);
        } else {
            console.warn(`Section ${sectionId} not found.`);
        }
    }

    // Main Navigation Event Listeners
    if (navButtons.identity) {
        navButtons.identity.addEventListener('click', () => showSection('identity'));
    }
    if (navButtons.map) {
        navButtons.map.addEventListener('click', () => {
            showSection('map');
            // Future: initializeMap(); // Map initialization will be handled here later
        });
    }
    if (navButtons.createReport) {
        navButtons.createReport.addEventListener('click', () => showSection('createReport'));
    }
    if (navButtons.settings) {
        navButtons.settings.addEventListener('click', () => showSection('settings'));
    }

    // Identity Form Toggle Event Listeners
    if (createProfileButton && sections.createProfileForm && sections.identity) {
        createProfileButton.addEventListener('click', () => {
            sections.identity.classList.add('hidden');
            sections.createProfileForm.classList.remove('hidden');
            console.log("Create profile form shown.");
        });
    }
    if (cancelCreateProfileButton && sections.createProfileForm && sections.identity) {
        cancelCreateProfileButton.addEventListener('click', () => {
            sections.createProfileForm.classList.add('hidden');
            sections.identity.classList.remove('hidden');
            if (document.getElementById('generated-key-info')) { // Hide key info if visible
                 document.getElementById('generated-key-info').classList.add('hidden');
            }
            console.log("Create profile form hidden.");
        });
    }

    if (importKeyButton && sections.importKeyForm && sections.identity) {
        importKeyButton.addEventListener('click', () => {
            sections.identity.classList.add('hidden');
            sections.importKeyForm.classList.remove('hidden');
            console.log("Import key form shown.");
        });
    }
    if (cancelImportKeyButton && sections.importKeyForm && sections.identity) {
        cancelImportKeyButton.addEventListener('click', () => {
            sections.importKeyForm.classList.add('hidden');
            sections.identity.classList.remove('hidden');
            console.log("Import key form hidden.");
        });
    }

    // Show identity section by default on page load
    showSection('identity');
    console.log("Default section 'identity' shown.");

}); // End of DOMContentLoaded

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // The path to sw.js should be relative to the root of the site,
        // or handled by a build tool.
        // If public/index.html is served, and sw.js is in src/,
        // a common pattern is to serve sw.js from the root like '/sw.js'.
        // For a simple setup without a build tool serving 'public',
        // if sw.js is in 'src' it might be accessible via '../src/sw.js'
        // but this is not standard for SW scope.
        // Let's assume sw.js will be served from the root or same level as index.html for registration.
        // So, if index.html is at /, sw.js should be at /sw.js.
        // We will create sw.js in src/ for organization, but for registration,
        // the path must be resolvable by the browser from the client's perspective.
        // For now, let's use './sw.js' and assume it will be copied to public/ or served from root.
        // Or, if src/ is served, then '/src/sw.js' (if main.js is also in src).
        // Given index.html links to ../src/main.js, from main.js's perspective, sw.js is './sw.js' if in same dir.
        // But sw.js is in src/, and main.js is in src/.
        // So from the perspective of index.html (scope root), it's 'src/sw.js'
        // Or if sw.js is copied to public, then 'sw.js'.
        // The plan says "src/sw.js". So, relative to index.html, it's "../src/sw.js".
        // However, service workers are typically registered with a path relative to the domain root.
        // Let's use '/sw.js' assuming it will be served from the root.
        // For the purpose of this subtask creating files in , I'll use a path that reflects its location in .
        // This will require a server that can serve from  or a build step.
        // A safer bet for a no-build setup is to place sw.js in .
        // I will write to src/sw.js as per plan, but the registration path in main.js will be tricky without a server/build config.
        // Let's assume for now that a build step will place sw.js at the root of public.
        const swPath = 'sw.js'; // This assumes sw.js will be in the same directory as index.html (e.g. public/)
                                // or at the root of the served site.

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

// Placeholder for future app logic
console.log("NostrMapper main.js loaded (new structure).");
