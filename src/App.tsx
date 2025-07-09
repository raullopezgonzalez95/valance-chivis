import React, { useState, useEffect } from 'react';
import { parse, ParseResult } from 'papaparse';
import './FinanceApp.css'; // Archivo de estilos que crearemos después
import { format, parse as dateParse } from 'date-fns';
import { es } from 'date-fns/locale';
import { getFinancialAdvice } from './components/GoogleGemini'; // Importamos nuestra función de AI

// Definimos el tipo para nuestras transacciones
interface Transaction {
  date: string; // DD-MM-YYYY
  description: string;
  payment: string;
  type: 'gasto' | 'venta';
  price: string;
}

// Tipo para los resúmenes
interface Summary {
  totalGastos: number;
  totalVentas: number;
  balance: number;
}

const FinanceApp: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [summary, setSummary] = useState<Summary>({ totalGastos: 0, totalVentas: 0, balance: 0 });
  const [responseGemini, setResponseGemini] = useState<string | null>(null);

  // Cargar datos del Google Sheet
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
            'https://docs.google.com/spreadsheets/d/e/2PACX-1vR5WIjTfzebRRz4aH6e36tqi9h4aV3hys9OJgTxRPbOnEC05e6SjZXc65jOvz-CxOP4Rxdgu6AhzZHj/pub?gid=0&single=true&output=csv'
        );

        if (!response.ok) throw new Error('Error al cargar los datos');

        const csvText = await response.text();

        parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results: ParseResult<Transaction>) => {
            // Validar y limpiar datos
            const validTransactions = results.data.filter(t =>
                t.date && t.description && ['gasto', 'venta'].includes(t.type) && t.price
            );

            setTransactions(validTransactions);
            setFilteredTransactions(validTransactions);
            setLoading(false);
          },
          error: (err: { message: any; }) => {
            throw new Error(`Error al leer CSV: ${err.message}`);
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Aplicar filtros y calcular resumen
  useEffect(() => {
    if (transactions.length === 0) return;

    let filtered = [...transactions];

    // Filtrar por fecha específica
    if (dateFilter) {
      filtered = filtered.filter(t => t.date === dateFilter.split('-').reverse().join('-'));
    }

    // Filtrar por rango de fechas
    if (startDate && endDate) {
      filtered = filtered.filter(t => {
        const transactionDate = new Date(t.date.split('-').reverse().join('-'));
        const start = new Date(startDate);
        const end = new Date(endDate);
        return transactionDate >= start && transactionDate <= end;
      });
    }

    setFilteredTransactions(filtered);

    // Calcular resumen
    const totalGastos = filtered
        .filter(t => t.type === 'gasto')
        .reduce((sum, t) => sum + parseFloat(t.price), 0);

    const totalVentas = filtered
        .filter(t => t.type === 'venta')
        .reduce((sum, t) => sum + parseFloat(t.price), 0);

    setSummary({
      totalGastos,
      totalVentas,
      balance: totalVentas - totalGastos
    });
  }, [transactions, dateFilter, startDate, endDate]);

  // Formatear número como dinero
  const formatMoney = (amount: number): string => {
    return new Intl.NumberFormat('es-Mx', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDisplayDate = (dateString: string): string => {
    const date = dateParse(dateString, 'dd-MM-yyyy', new Date());
    return format(date, 'EEEE d MMMM yyyy', { locale: es });
  };

  if (loading) return <div className="loading">Cargando datos financieros...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
      <div className="finance-app">
        <h1>Mis Finanzas</h1>

        {/* Filtros */}
        <div className="filters">
          <div className="filter-group">
            <label>Filtrar por fecha específica:</label>
            <input
                type="date"
                placeholder="DD-MM-AAAA"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setStartDate('');
                  setEndDate('');
                }}
            />
          </div>

          <div className="filter-group">
            <label>Filtrar por rango de fechas:</label>
            <div className="date-range">
              <input
                  type="date"
                  placeholder="DD-MM-AAAA (inicio)"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDateFilter('');
                  }}
              />
              <span>a</span>
              <input
                  type="date"
                  placeholder="DD-MM-AAAA (fin)"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDateFilter('');
                  }}
              />
            </div>
          </div>
        </div>

        {/* Resumen */}
        <div className="summary">
          <div className={`summary-card ${summary.balance >= 0 ? 'positive' : 'negative'}`}>
            <h3>Balance Total</h3>
            <p>{formatMoney(summary.balance)}</p>
          </div>
          <div className="summary-card">
            <h3>Total Ventas</h3>
            <p className="positive">{formatMoney(summary.totalVentas)}</p>
          </div>
          <div className="summary-card">
            <h3>Total Gastos</h3>
            <p className="negative">{formatMoney(summary.totalGastos)}</p>
          </div>
        </div>

        {/* Lista de transacciones */}
        <div className="transactions">
          <h2>Transacciones</h2>
          <h3>
            {dateFilter 
            ? formatDisplayDate(dateFilter.split('-').reverse().join('-')) 
            : (startDate && endDate ? `${formatDisplayDate(startDate.split('-').reverse().join('-'))} a ${formatDisplayDate(endDate.split('-').reverse().join('-'))}` : '')}
          </h3>

        {filteredTransactions.length > 0 && (
          <div className="w-full max-w-2xl mx-auto mt-8 p-4 rounded-xl bg-white shadow-lg border">
            <button
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-full transition duration-200 w-full"
              onClick={async () => {
                const advice = await getFinancialAdvice(
                  summary.totalVentas,
                  summary.totalGastos,
                  summary.balance,
                  filteredTransactions,
                  dateFilter || `${startDate} a ${endDate}`
                );
                setResponseGemini(advice || "No se pudo generar la asesoría.");
              }}
            >
              💡 Obtener asesoría financiera
            </button>

            {responseGemini && (
              <div className="mt-6 space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="bg-gray-100 text-gray-800 p-4 rounded-xl shadow-sm max-w-xl">
                    <p className="whitespace-pre-line">
                      {responseGemini
                        .split(/\n+/)
                        .map((line, idx) => (
                          <p key={idx}>{line}</p>
                        ))}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
          {filteredTransactions.length === 0 ? (
              <p>No hay transacciones en este período</p>
          ) : (
              <table>
                <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Tipo de pago</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                </tr>
                </thead>
                <tbody>
                {filteredTransactions.map((t, index) => (
                    <tr key={index}>
                      <td data-label="Fecha">{formatDisplayDate(t.date)}</td>
                      <td data-label="Descripción">{t.description}</td>
                      <td data-label="Tipo de pago">{t.payment}</td>
                      <td data-label="Tipo" className={t.type}>{t.type === 'gasto' ? 'Gasto' : 'Venta'}</td>
                      <td data-label="Monto" className={t.type}>
                        {t.type === 'gasto' ? '-' : '+'}{formatMoney(parseFloat(t.price))}
                      </td>
                    </tr>
                ))}
                </tbody>
              </table>
          )}
        </div>
      </div>
  );
};

export default FinanceApp;