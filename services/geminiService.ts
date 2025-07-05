
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { BillItem } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const fileToGenerativePart = (base64Data: string, mimeType: string) => {
  return {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };
};

export const extractItemsFromReceipt = async (base64Image: string): Promise<BillItem[]> => {
  const model = 'gemini-2.5-flash-preview-04-17';
  const imagePart = fileToGenerativePart(base64Image.split(',')[1], base64Image.split(';')[0].split(':')[1]);

  const prompt = `
    Analiza la imagen del recibo. Extrae cada artículo, su cantidad y su precio total.
    - Ignora impuestos, cargos por servicio, propinas y las líneas de suma total.
    - Si no se especifica la cantidad, asume que es 1.
    - El precio debe ser un número.
    - Devuelve los datos como un array JSON de objetos. Cada objeto debe tener las claves: "name" (string), "quantity" (number), y "price" (number).
    - Si la imagen no es un recibo o no se puede leer, devuelve un array vacío.
    - Tu respuesta completa debe ser únicamente el array JSON, sin ningún otro texto o delimitadores de markdown.
    Ejemplo: [{"name": "Hamburguesa", "quantity": 1, "price": 12.50}, {"name": "Patatas Fritas", "quantity": 2, "price": 4.00}]
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
      }
    });
    
    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    
    const parsedData: { name: string; quantity: number; price: number }[] = JSON.parse(jsonStr);

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
    console.error("Error processing receipt with Gemini API:", error);
    throw new Error("Error al analizar los datos del recibo desde la respuesta de la IA.");
  }
};