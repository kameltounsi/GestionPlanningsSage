package com.gestionplanning.storage;

public class StoredAsset {
    private final String fileName;
    private final String contentType;
    private final Long size;
    private final String url;
    private final String publicId;
    private final String resourceType;

    public StoredAsset(String fileName, String contentType, Long size, String url, String publicId, String resourceType) {
        this.fileName = fileName;
        this.contentType = contentType;
        this.size = size;
        this.url = url;
        this.publicId = publicId;
        this.resourceType = resourceType;
    }

    public String getFileName() {
        return fileName;
    }

    public String getContentType() {
        return contentType;
    }

    public Long getSize() {
        return size;
    }

    public String getUrl() {
        return url;
    }

    public String getPublicId() {
        return publicId;
    }

    public String getResourceType() {
        return resourceType;
    }
}
