import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createSupplier, type Supplier, type SupplierPayload } from '../../../../services/suppliers.service';
import { getApiErrorMessage } from '../../../../lib/apiError';
import { Button, Modal } from '../../../../components/ui';

const FIELD_CLASS =
  'w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm';

interface SupplierModalProps {
  onClose: () => void;
  onSaved: (supplier: Supplier) => void;
}

/**
 * Modal de creación inline de proveedor. El backend requiere name, nit y category
 * (CreateSupplierDto); contact es un objeto libre con contactName/phone/email.
 */
export default function SupplierModal({ onClose, onSaved }: SupplierModalProps) {
  const [form, setForm] = useState({
    name: '',
    nit: '',
    category: 'GENERAL',
    contactName: '',
    phone: '',
    email: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: SupplierPayload) => createSupplier(payload),
    onSuccess: (supplier) => onSaved(supplier),
    onError: (err) => setFormError(getApiErrorMessage(err, 'No se pudo crear el proveedor')),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const name = form.name.trim();
    const nit = form.nit.trim();
    if (name.length < 2) {
      setFormError('El nombre debe tener al menos 2 caracteres');
      return;
    }
    if (nit.length < 3) {
      setFormError('El NIT debe tener al menos 3 caracteres');
      return;
    }
    const contact: Record<string, unknown> = {};
    if (form.contactName.trim()) contact.contactName = form.contactName.trim();
    if (form.phone.trim()) contact.phone = form.phone.trim();
    if (form.email.trim()) contact.email = form.email.trim();
    mutation.mutate({
      name,
      nit,
      category: form.category.trim() || 'GENERAL',
      status: 'active',
      ...(Object.keys(contact).length > 0 ? { contact } : {}),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Crear proveedor"
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="create-supplier-form" loading={mutation.isPending}>Crear</Button>
        </>
      }
    >
      <form id="create-supplier-form" onSubmit={submit} className="space-y-4">
        {formError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-sm" role="alert">
            {formError}
          </div>
        )}

        <div>
          <label htmlFor="supplier-name" className="block text-sm font-medium text-neutral-800 mb-1.5">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            id="supplier-name"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={FIELD_CLASS}
            required
            minLength={2}
            placeholder="Ej: Distribuidora Hikvision Colombia SAS"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="supplier-nit" className="block text-sm font-medium text-neutral-800 mb-1.5">
              NIT <span className="text-red-500">*</span>
            </label>
            <input
              id="supplier-nit"
              type="text"
              value={form.nit}
              onChange={(e) => setForm({ ...form, nit: e.target.value })}
              className={FIELD_CLASS}
              required
              minLength={3}
              placeholder="900123456-7"
            />
          </div>
          <div>
            <label htmlFor="supplier-category" className="block text-sm font-medium text-neutral-800 mb-1.5">
              Categoría <span className="text-red-500">*</span>
            </label>
            <input
              id="supplier-category"
              type="text"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={FIELD_CLASS}
              required
              minLength={1}
              placeholder="VIDEO"
            />
          </div>
        </div>

        <div>
          <label htmlFor="supplier-contact-name" className="block text-sm font-medium text-neutral-800 mb-1.5">
            Persona de contacto
          </label>
          <input
            id="supplier-contact-name"
            type="text"
            value={form.contactName}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
            className={FIELD_CLASS}
            placeholder="Ana"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="supplier-phone" className="block text-sm font-medium text-neutral-800 mb-1.5">
              Teléfono
            </label>
            <input
              id="supplier-phone"
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={FIELD_CLASS}
              placeholder="+57 300 123 4567"
            />
          </div>
          <div>
            <label htmlFor="supplier-email" className="block text-sm font-medium text-neutral-800 mb-1.5">
              Email
            </label>
            <input
              id="supplier-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={FIELD_CLASS}
              placeholder="ventas@distribuidora.com"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}