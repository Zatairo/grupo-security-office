import { create } from 'zustand'

/**
 * Estado transitorio del constructor de cotizaciones mientras se arma:
 * la selección de cliente / Lista / tarifa del formulario de creación,
 * para que los pasos (y futuras subrutas del constructor) compartan
 * la misma fuente sin props anidadas. No guarda montos: el dinero
 * vive siempre en el backend y se refresca por React Query.
 */
interface QuoteBuilderState {
  customerId: string
  listaId: string
  priceListId: string
  validUntil: string
  taxRate: string
  notes: string
  setField: (
    field:
      | 'customerId'
      | 'listaId'
      | 'priceListId'
      | 'validUntil'
      | 'taxRate'
      | 'notes',
    value: string
  ) => void
  reset: () => void
}

const EMPTY = {
  customerId: '',
  listaId: '',
  priceListId: '',
  validUntil: '',
  taxRate: '',
  notes: '',
}

export const useQuoteBuilderStore = create<QuoteBuilderState>((set) => ({
  ...EMPTY,
  setField: (field, value) => set({ [field]: value }),
  reset: () => set({ ...EMPTY }),
}))
