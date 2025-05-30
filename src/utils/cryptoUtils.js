// === src/utils/cryptoUtils.js ===
// For now, functions are global or within a simple namespace if preferred,
// assuming this file is loaded before scripts that use these functions.

console.log("cryptoUtils.js loading...");

async function encryptData(data, password) {
    console.log("Encrypting data...");
    try {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        const key = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
        const encodedData = new TextEncoder().encode(data);
        const encryptedContent = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encodedData
        );
        const encryptedArr = new Uint8Array(encryptedContent);
        console.log("Data encrypted successfully.");
        return {
            salt: btoa(String.fromCharCode.apply(null, salt)),
            iv: btoa(String.fromCharCode.apply(null, iv)),
            encryptedData: btoa(String.fromCharCode.apply(null, encryptedArr))
        };
    } catch (error) {
        console.error("Encryption failed:", error);
        throw new Error("Encryption failed: " + error.message);
    }
}

async function decryptData(encryptedObj, password) {
    console.log("Decrypting data...");
    try {
        const salt = Uint8Array.from(atob(encryptedObj.salt), c => c.charCodeAt(0));
        const iv = Uint8Array.from(atob(encryptedObj.iv), c => c.charCodeAt(0));
        const encryptedData = Uint8Array.from(atob(encryptedObj.encryptedData), c => c.charCodeAt(0));

        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        const key = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
        const decryptedContent = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encryptedData
        );
        const decodedString = new TextDecoder().decode(decryptedContent);
        console.log("Data decrypted successfully.");
        return decodedString;
    } catch (error) {
        console.error("Decryption failed:", error);
        throw new Error("Decryption failed. Incorrect passphrase or corrupted data.");
    }
}

console.log("cryptoUtils.js loaded.");
