package com.gestionplanning.storage;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

@Service
public class CloudinaryStorageService {
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
            Map uploadResult = cloudinary.uploader().upload(file.getBytes(), ObjectUtils.asMap(
                    "folder", folder,
                    "resource_type", "auto",
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
                    String.valueOf(uploadResult.get("resource_type"))
            );
        } catch (IOException exception) {
            throw new IllegalStateException("Impossible d'envoyer le fichier vers Cloudinary", exception);
        }
    }

    public DownloadedAsset download(String fileUrl, String fallbackContentType) {
        if (fileUrl == null || fileUrl.trim().isEmpty()) {
            throw new IllegalArgumentException("URL fichier manquante");
        }
        try {
            HttpURLConnection connection = (HttpURLConnection) new URL(fileUrl).openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(30000);
            String contentType = connection.getContentType();
            if (contentType == null || contentType.trim().isEmpty()) {
                contentType = fallbackContentType;
            }
            if (contentType == null || contentType.trim().isEmpty()) {
                contentType = "application/octet-stream";
            }
            return new DownloadedAsset(StreamUtils.copyToByteArray(connection.getInputStream()), contentType);
        } catch (IOException exception) {
            throw new IllegalStateException("Impossible de telecharger le fichier depuis Cloudinary", exception);
        }
    }

    public void deleteQuietly(String publicId, String resourceType) {
        if (publicId == null || publicId.trim().isEmpty()) {
            return;
        }
        try {
            cloudinary.uploader().destroy(publicId, ObjectUtils.asMap(
                    "resource_type", resourceType == null || resourceType.trim().isEmpty() ? "image" : resourceType
            ));
        } catch (Exception ignored) {
            // La suppression applicative ne doit pas echouer si l'asset Cloudinary est deja absent.
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
}
