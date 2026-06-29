package com.gestionplanning.storage;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class StoredAssetTest {
    @Test
    void exposesStoredAssetMetadata() {
        StoredAsset asset = new StoredAsset(
                "proof.pdf",
                "application/pdf",
                128L,
                "https://cdn.example/proof.pdf",
                "gestion-planning/proof",
                "raw"
        );

        assertEquals("proof.pdf", asset.getFileName());
        assertEquals("application/pdf", asset.getContentType());
        assertEquals(128L, asset.getSize());
        assertEquals("https://cdn.example/proof.pdf", asset.getUrl());
        assertEquals("gestion-planning/proof", asset.getPublicId());
        assertEquals("raw", asset.getResourceType());
    }
}
