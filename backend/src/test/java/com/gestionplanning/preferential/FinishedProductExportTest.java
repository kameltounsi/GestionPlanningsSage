package com.gestionplanning.preferential;

import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.Row;
import org.junit.jupiter.api.Test;
import java.io.ByteArrayInputStream;
import java.lang.reflect.Method;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class FinishedProductExportTest {
    @Test
    void readableHeadersRemainCompatibleWithImporterAndPreserveReferenceZeros() throws Exception {
        FinishedProductReferenceController controller = mock(FinishedProductReferenceController.class, CALLS_REAL_METHODS);
        FinishedProductReference product = new FinishedProductReference();
        product.setPartNumber("00042");
        product.setClient("Client Exemple");
        product.setProductionIntegrationDate(LocalDate.of(2026, 10, 14));
        Method export = FinishedProductReferenceController.class.getDeclaredMethod("exportWorkbook", List.class);
        export.setAccessible(true);
        byte[] bytes = (byte[]) export.invoke(controller, Collections.singletonList(product));
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
            Row header = workbook.getSheetAt(0).getRow(0);
            Method columns = FinishedProductReferenceController.class.getDeclaredMethod("headerColumns", Row.class);
            columns.setAccessible(true);
            Map<?, ?> keys = (Map<?, ?>) columns.invoke(controller, header);
            assertEquals(2, keys.get("referenceinterne"));
            assertEquals(10, keys.get("dateintegrationproduction"));
            assertEquals("00042", workbook.getSheetAt(0).getRow(1).getCell(2).getStringCellValue());
            assertEquals("dd/mm/yyyy", workbook.getSheetAt(0).getRow(1).getCell(10).getCellStyle().getDataFormatString());
            assertNotNull(workbook.getSheetAt(0).getPaneInformation());
        }
    }
}
