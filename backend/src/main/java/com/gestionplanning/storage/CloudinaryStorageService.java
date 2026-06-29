package com.gestionplanning.storage;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.util.Map;

@Service
public class CloudinaryStorageService {
    private static final Logger LOGGER = LoggerFactory.getLogger(CloudinaryStorageService.class);
    private static final String RESOURCE_TYPE = "resource_type";
    private static final String IMAGE_RESOURCE_TYPE = "image";

    private final Cloudinary cloudinary;
    private final String cloudName;
    private final String apiKey;
    private final String apiSecret;

    public CloudinaryStorageService(@Value("${cloudinary.cloud-name}") String cloudName,
                                    @Value("${cloudinary.api-key}") String apiKey,
                                    @Value("${cloudinary.api-secret}") String apiSecret) {
        this.cloudName = cloudName;
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.cloudinary = new Cloudinary(ObjectUtils.asMap(
                "cloud_name", cloudName,
                "api_key", apiKey,
                "api_secret", apiSecret,
                "secure", true
        ));
    }

    public StoredAsset upload(MultipartFile file, String folder) {
        validateConfiguration();
        try {
            String resourceType = resourceTypeFor(file);
            Map<?, ?> uploadResult = cloudinary.uploader().upload(file.getBytes(), ObjectUtils.asMap(
                    "folder", folder,
                    RESOURCE_TYPE, resourceType,
                    "access_mode", "public",
                    "filename_override", file.getOriginalFilename(),
                    "use_filename", true,
                    "unique_filename", true
            ));
            return new StoredAsset(
                    file.getOriginalFilename(),
                    file.getContentType(),
                    file.getSize(),
                    String.valueOf(uploadResult.get("secure_url")),
                    String.valueOf(uploadResult.get("public_id")),
                    String.valueOf(uploadResult.get(RESOURCE_TYPE))
            );
        } catch (IOException | RuntimeException exception) {
            LOGGER.error("Cloudinary upload failed for folder {}", folder, exception);
            throw new IllegalStateException("Impossible d'envoyér le fichier vers Cloudinary", exception);
        }
    }

    public DownloadedAsset download(String publicId, String resourceType, String fileUrl, String fallbackContentType) {
        if (publicId != null && !publicId.trim().isEmpty()) {
            if ("raw".equalsIgnoreCase(resourceType)) {
                try {
                    return downloadFromUrl(privateDownloadUrl(publicId, resourceType), fallbackContentType);
                } catch (RuntimeException exception) {
                    LOGGER.warn("Cloudinary private download failed for {}: {}", publicId, exception.getMessage());
                }
            }
            try {
                return downloadFromUrl(signedUrl(publicId, resourceType, fileUrl), fallbackContentType);
            } catch (RuntimeException exception) {
                LOGGER.warn("Cloudinary signed download failed for {}: {}", publicId, exception.getMessage());
            }
        }
        return download(fileUrl, fallbackContentType);
    }

    public DownloadedAsset download(String fileUrl, String fallbackContentType) {
        if (fileUrl == null || fileUrl.trim().isEmpty()) {
            throw new IllegalArgumentException("URL fichier manquante");
        }
        return downloadFromUrl(fileUrl, fallbackContentType);
    }

    private DownloadedAsset downloadFromUrl(String fileUrl, String fallbackContentType) {
        try {
            HttpURLConnection connection = (HttpURLConnection) URI.create(fileUrl).toURL().openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(30000);
            int responseCode = connection.getResponseCode();
            if (responseCode < 200 || responseCode >= 300) {
                throw new DownloadException("Cloudinary returned HTTP " + responseCode + " for " + fileUrl, responseCode);
            }
            String contentType = connection.getContentType();
            if (contentType == null || contentType.trim().isEmpty()) {
                contentType = fallbackContentType;
            }
            if (contentType == null || contentType.trim().isEmpty()) {
                contentType = "application/octet-stream";
            }
            return new DownloadedAsset(StreamUtils.copyToByteArray(connection.getInputStream()), contentType);
        } catch (IOException exception) {
            throw new DownloadException("Impossible de telecharger le fichier depuis Cloudinary", exception);
        }
    }

    private String signedUrl(String publicId, String resourceType, String fileUrl) {
        com.cloudinary.Url url = cloudinary.url()
                .secure(true)
                .signed(true)
                .resourceType(resourceType == null || resourceType.trim().isEmpty() ? IMAGE_RESOURCE_TYPE : resourceType);
        String version = versionFromUrl(fileUrl);
        if (version != null) {
            url.version(version);
        }
        return url.generate(publicId);
    }

    private String privateDownloadUrl(String publicId, String resourceType) {
        try {
            return cloudinary.privateDownload(publicId, null, ObjectUtils.asMap(
                    RESOURCE_TYPE, resourceType == null || resourceType.trim().isEmpty() ? "raw" : resourceType,
                    "type", "upload",
                    "attachment", false
            ));
        } catch (Exception exception) {
            throw new IllegalStateException("Impossible de generer l'URL privee Cloudinary", exception);
        }
    }

    public static class DownloadedAsset {
        private final byte[] data;
        private final String contentType;

        public DownloadedAsset(byte[] data, String contentType) {
            this.data = data;
            this.contentType = contentType;
        }

        public byte[] getData() {
            return data;
        }

        public String getContentType() {
            return contentType;
        }
    }

    public static class DownloadException extends IllegalStateException {
        private final Integer statusCode;

        public DownloadException(String message, Integer statusCode) {
            super(message);
            this.statusCode = statusCode;
        }

        public DownloadException(String message, Throwable cause) {
            super(message, cause);
            this.statusCode = null;
        }

        public Integer getStatusCode() {
            return statusCode;
        }

        public boolean isNotFound() {
            return Integer.valueOf(404).equals(statusCode);
        }
    }

    public void deleteQuietly(String publicId, String resourceType) {
        if (publicId == null || publicId.trim().isEmpty()) {
            return;
        }
        try {
            cloudinary.uploader().destroy(publicId, ObjectUtils.asMap(
                    RESOURCE_TYPE, resourceType == null || resourceType.trim().isEmpty() ? IMAGE_RESOURCE_TYPE : resourceType
            ));
        } catch (Exception ignored) {
            // La suppression applicative ne doit pas échouer si l'asset Cloudinary est déjà absent.
        }
    }

    private void validateConfiguration() {
        requireValue(cloudName, "cloudinary.cloud-name");
        requireValue(apiKey, "cloudinary.api-key");
        requireValue(apiSecret, "cloudinary.api-secret");
    }

    private void requireValue(String value, String propertyName) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalStateException("Configuration Cloudinary manquante: " + propertyName);
        }
    }

    private String resourceTypeFor(MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType == null) {
            return "raw";
        }
        if (contentType.startsWith("image/")) {
            return IMAGE_RESOURCE_TYPE;
        }
        if (contentType.startsWith("video/")) {
            return "video";
        }
        return "raw";
    }

    private String versionFromUrl(String fileUrl) {
        if (fileUrl == null) {
            return null;
        }
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("/v(\\d+)/").matcher(fileUrl);
        return matcher.find() ? matcher.group(1) : null;
    }

}
