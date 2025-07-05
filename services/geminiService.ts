import { BillItem } from '../types';

export const extractItemsFromReceipt = async (base64Image: string): Promise<BillItem[]> => {
  try {
    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ base64Image }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Server error:", errorData);
        throw new Error(errorData.error || `Error from server: ${response.statusText}`);
    }

    const parsedData: { name: string; quantity: number; price: number }[] = await response.json();
    
    if (Array.isArray(parsedData)) {
      return parsedData
        .filter(item => item.name && typeof item.price === 'number' && item.price > 0)
        .flatMap(item => {
          const quantity = item.quantity && typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
          
          if (quantity <= 1) {
            return [{
              id: crypto.randomUUID(),
              name: item.name,
              price: item.price,
              assignedTo: [],
            }];
          } else {
            const singleItemPrice = item.price / quantity;
            return Array.from({ length: quantity }, (_, i) => ({
              id: crypto.randomUUID(),
              name: `${item.name} (${i + 1}/${quantity})`,
              price: singleItemPrice,
              assignedTo: [],
            }));
          }
        });
    }
    return [];

  } catch (error) {
    console.error("Error calling /api/scan endpoint:", error);
    // This is the error message that will be displayed to the user in the UI.
    throw new Error("Error al procesar el recibo. Por favor, inténtalo de nuevo o introduce los artículos manualmente.");
  }
};
