const geminiKey = '';
const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

interface Transaction {
  date: string;
  description: string;
  payment: string;
  type: 'gasto' | 'venta';
  price: string;
}

export const getFinancialAdvice = async (
  totalVentas: number,
  totalGastos: number,
  balance: number,
  data: Transaction[],
  fecha: string
): Promise<string | null> => {
  const prompt = [
    `Eres un asesor financiero inteligente.`,
    ``,
    `Te doy un resumen de mis finanzas de una semana (de lunes a viernes).`,
    ``,
    `Resumen semanal - ${fecha}`,
    `- Total de ventas: ${totalVentas}`,
    `- Total de gastos: ${totalGastos}`,
    `- Balance neto: ${balance}`,
    `- Transacciones:`,
    ...data.map(t => `  - ${t.date} | ${t.description} | ${t.payment} | ${t.type} | ${t.price}`),
    ``,
    `Dame un análisis en 3 partes:\n\n1. Resumen...\n\n2. Observaciones...\n\n3. Recomendaciones...`,
    ``,
    `El tono debe ser claro, directo y útil.`
  ].join('\n');


  try {
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': geminiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      }),
    });

    if (!response.ok) {
      console.error(`Error: ${response.status} - ${response.statusText}`);
      return null;
    }

    const result = await response.json();
    return result?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (error) {
    console.error('Error al obtener el consejo financiero:', error);
    return null;
  }
};
