// === src/services/imageUploadService.js ===
// Service for uploading images to a hosting provider (e.g., nostr.build).

console.log("imageUploadService.js loading...");

// Using nostr.build as the default upload endpoint
const NOSTR_BUILD_UPLOAD_ENDPOINT = 'https://nostr.build/api/v2/upload/files'; // Check current API endpoint

/**
 * Uploads an image file to nostr.build.
 * @param {File} file - The image file to upload.
 * @returns {Promise<Object|null>} A promise that resolves with an object containing upload data (e.g., url, sha256, blurhash, type, width, height) or null on failure.
 *                                  The exact structure depends on nostr.build's API response.
 *                                  We expect at least a URL for the image.
 */
export async function uploadImage(file) {
    if (!file) {
        console.error("uploadImage: No file provided.");
        return null;
    }

    console.log(`uploadImage: Starting upload for ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);

    const formData = new FormData();
    formData.append('file', file); // The API might expect a different field name, e.g., 'fileToUpload' or specific to NIP-96 like 'file[]'
                                   // For nostr.build's /api/v2/upload/files, it seems to accept 'file' or just a direct file stream.
                                   // Let's assume 'file' is a common field name for FormData.
                                   // NIP-96 specifies `multipart/form-data` with one or more `file` parts.

    try {
        // Note: nostr.build's /api/v2/upload/files might not need FormData for a single file if NIP-96 form-data is used.
        // However, many simple PHP endpoints use FormData with a field name.
        // Let's try with FormData and 'file' first.
        // If that fails, a direct POST with the file body and correct Content-Type might be an alternative,
        // but FormData is standard for file uploads.
        // The NIP-96 spec suggests `curl -F file[]=@filename.png ...` which implies an array field name.
        // For simplicity, let's try a single file with field name 'file'.
        // If using nostr.build's simple POST target (not the NIP-96 one), it might be different.
        // Their website uploader uses `https://nostr.build/upload.php` and a field `fileToUpload`.
        // Let's use the one mentioned often for API: `https://nostr.build/api/v2/upload/files` (NIP-96)
        // This endpoint expects a `multipart/form-data` request.
        // It might also support `Authorization: Bearer <nip98_token>` for auth uploads. We are doing anonymous.

        const response = await fetch(NOSTR_BUILD_UPLOAD_ENDPOINT, {
            method: 'POST',
            body: formData,
            // For NIP-96, you might not need to set Content-Type; FormData handles it.
            // Some servers are picky. If issues, try removing or setting explicitly.
            // headers: {
            //    'Content-Type': 'multipart/form-data' // Usually set by browser with FormData
            // }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`uploadImage: Failed to upload ${file.name}. Status: ${response.status}. Response: ${errorText}`);
            throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
        }

        const responseData = await response.json();
        console.log(`uploadImage: Upload successful for ${file.name}. Response data:`, responseData);

        // Process responseData to extract relevant information.
        // nostr.build /api/v2/upload/files returns an object like:
        // {
        //   "status": "success",
        //   "data": [
        //     {
        //       "url": "https://nostr.build/i/nostr.build_...jpg",
        //       "sha256": "...",
        //       "blurhash": "...",
        //       "mime_type": "image/jpeg",
        //       "width": 1024,
        //       "height": 768,
        //       "size": 12345
        //     }
        //   ]
        // }
        // Or for errors: { "status": "error", "message": "..." }

        if (responseData.status === "success" && responseData.data && responseData.data.length > 0) {
            const uploadedFile = responseData.data[0];
            return {
                url: uploadedFile.url,
                sha256: uploadedFile.sha256,
                blurhash: uploadedFile.blurhash,
                mimeType: uploadedFile.mime_type,
                width: uploadedFile.width,
                height: uploadedFile.height,
                size: uploadedFile.size
                // Add any other relevant fields NIP-94 might use
            };
        } else if (responseData.status === "error") {
            console.error(`uploadImage: API error for ${file.name}: ${responseData.message}`);
            throw new Error(`Image upload API error: ${responseData.message}`);
        } else {
            console.error(`uploadImage: Unexpected API response structure for ${file.name}:`, responseData);
            throw new Error("Unexpected API response structure after image upload.");
        }

    } catch (error) {
        console.error(`uploadImage: Exception during upload of ${file.name}:`, error);
        // Return null or rethrow, depending on how errors should be handled by caller
        return null;
    }
}

console.log("imageUploadService.js loaded.");
