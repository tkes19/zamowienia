/**
 * Serwis PDF - wrapper dla generatorów PDF
 * Centralizuje logikę generowania dokumentów PDF
 */

const { 
  createProductionWorkOrderPDF, 
  createGraphicsTaskPDF, 
  createPackingListPDF 
} = require('../pdfGenerator');

/**
 * Generowanie PDF zlecenia produkcyjnego (Work Order)
 */
async function generateWorkOrderPDF(workOrderData) {
  try {
    return await createProductionWorkOrderPDF(workOrderData);
  } catch (error) {
    console.error('[pdfService] Error generating work order PDF:', error);
    throw new Error('Błąd generowania PDF zlecenia produkcyjnego');
  }
}

/**
 * Generowanie PDF zadania graficznego
 */
async function generateGraphicsTaskPDF(taskData) {
  try {
    return await createGraphicsTaskPDF(taskData);
  } catch (error) {
    console.error('[pdfService] Error generating graphics task PDF:', error);
    throw new Error('Błąd generowania PDF zadania graficznego');
  }
}

/**
 * Generowanie PDF listy kompletacyjnej
 */
async function generatePackingListPDF(orderData) {
  try {
    return await createPackingListPDF(orderData);
  } catch (error) {
    console.error('[pdfService] Error generating packing list PDF:', error);
    throw new Error('Błąd generowania PDF listy kompletacyjnej');
  }
}

/**
 * Logowanie audytu druku
 */
async function logPrintAudit(supabase, auditData) {
  const { userId, documentType, documentId, metadata } = auditData;
  
  try {
    const { error } = await supabase
      .from('PrintAudit')
      .insert({
        userId,
        documentType,
        documentId,
        metadata: metadata || {},
        printedAt: new Date().toISOString()
      });

    if (error) {
      console.error('[pdfService] Error logging print audit:', error);
    }
  } catch (error) {
    console.error('[pdfService] Exception logging print audit:', error);
  }
}

module.exports = {
  generateWorkOrderPDF,
  generateGraphicsTaskPDF,
  generatePackingListPDF,
  logPrintAudit
};
