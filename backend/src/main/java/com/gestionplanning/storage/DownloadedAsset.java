package com.gestionplanning.storage;

public class DownloadedAsset {
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
