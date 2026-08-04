import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { hasPermission } from '../lib/rbac'
import { getApiErrorMessage } from '../lib/apiError'

interface CategoryNode {
  id: string
  name: string
  slug: string
  description?: string | null
  parentId: string | null
  isActive: boolean
  _count?: { products: number }
  children?: CategoryNode[]
}

function collectParents(nodes: CategoryNode[], acc: { id: string; name: string }[] = []): { id: string; name: string }[] {
  for (const node of nodes) {
    acc.push({ id: node.id, name: node.name })
    if (node.children?.length) collectParents(node.children, acc)
  }
  return acc
}

function collectDescendantIds(node: CategoryNode, acc: Set<string>): void {
  for (const child of node.children ?? []) {
    acc.add(child.id)
    collectDescendantIds(child, acc)
  }
}

export default function CategoriesPage() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryNode | null>(null)

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories/tree')
      return res.data as CategoryNode[]
    },
  })

  const deleteCategory = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  })

  const handleDeleted = (id: string) => {
    if (confirm('¿Eliminar esta categoría?')) deleteCategory.mutate(id)
  }

  const parents = categories ? collectParents(categories) : []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-security-700">Categorías</h1>
          <p className="text-sm text-gray-500 mt-1">Organiza tu catálogo por categorías jerárquicas</p>
        </div>
        {hasPermission('categories:write') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-security-500 text-white rounded-lg font-semibold hover:bg-security-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Categoría
          </button>
        )}
      </div>

      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 rounded-xl"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-100 rounded w-1/2 mb-2"></div>
                  <div className="h-3 bg-gray-100 rounded w-1/3"></div>
                </div>
              </div>
            </div>
          ))
        ) : categories?.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <p className="text-gray-500 font-medium">No hay categorías</p>
          </div>
        ) : (
          categories?.map((node) => (
            <CategoryBranch
              key={node.id}
              node={node}
              depth={0}
              onDelete={handleDeleted}
              onEdit={setEditingCategory}
            />
          ))
        )}
      </div>

      {showCreateModal && (
        <CategoryModal
          parents={parents}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setShowCreateModal(false) }}
        />
      )}

      {editingCategory && (
        <CategoryModal
          category={editingCategory}
          parents={parents}
          onClose={() => setEditingCategory(null)}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setEditingCategory(null) }}
        />
      )}
    </div>
  )
}

function CategoryBranch({ node, depth, onDelete, onEdit }: {
  node: CategoryNode
  depth: number
  onDelete: (id: string) => void
  onEdit: (node: CategoryNode) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const children = node.children ?? []
  const hasChildren = children.length > 0

  return (
    <div>
      <div
        className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-shadow"
        style={{ marginLeft: depth * 20 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hasChildren ? (
              <button
                onClick={() => setCollapsed((c) => !c)}
                className="p-1 text-gray-400 hover:text-security-600 rounded transition-colors"
                aria-label={collapsed ? 'Expandir categoría' : 'Contraer categoría'}
              >
                <svg
                  className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-90'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <span className="w-6" />
            )}
            <div className="w-12 h-12 bg-security-50 rounded-xl flex items-center justify-center text-security-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{node.name}</h3>
              <p className="text-xs text-gray-400 font-mono">{node.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {hasPermission('categories:write') && (
              <button
                onClick={() => onEdit(node)}
                className="p-2 text-gray-400 hover:text-security-600 hover:bg-security-50 rounded-lg transition-colors"
                title="Editar categoría"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {hasPermission('categories:delete') && (
              <button
                onClick={() => onDelete(node.id)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar categoría"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">{node._count?.products ?? 0} productos</span>
          <span className={`px-2 py-1 text-xs font-medium rounded ${node.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {node.isActive ? 'Activa' : 'Inactiva'}
          </span>
        </div>
      </div>

      {hasChildren && !collapsed && (
        <div className="mt-2 space-y-2">
          {children.map((child) => (
            <CategoryBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryModal({ category, parents, onClose, onSuccess }: {
  category?: CategoryNode | null
  parents: { id: string; name: string }[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    name: category?.name || '',
    slug: category?.slug || '',
    description: category?.description || '',
    parentId: category?.parentId || '',
  })
  const [formError, setFormError] = useState<string | null>(null)

  const forbiddenIds = new Set<string>()
  if (category) {
    forbiddenIds.add(category.id)
    for (const child of category.children ?? []) collectDescendantIds(child, forbiddenIds)
  }
  const parentOptions = parents.filter((p) => !forbiddenIds.has(p.id))

  const mutation = useMutation({
    mutationFn: (data: typeof form) => {
      const payload = { ...data, parentId: data.parentId || null }
      return category ? api.put(`/categories/${category.id}`, payload) : api.post('/categories', payload)
    },
    onSuccess,
    onError: (error) => setFormError(getApiErrorMessage(error, 'No se pudo guardar la categoría')),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    mutation.mutate(form)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 bg-security-700 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">{category ? 'Editar Categoría' : 'Nueva Categoría'}</h2>
            <button onClick={onClose} className="p-2 text-security-200 hover:text-white hover:bg-security-600 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-sm" role="alert">
              {formError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Slug</label>
            <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Categoría padre</label>
            <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary">
              <option value="">Sin categoría padre (raíz)</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary resize-none" rows={3} />
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2.5 bg-security-500 text-white rounded-lg hover:bg-security-600 disabled:opacity-50 font-semibold transition-colors">
              {mutation.isPending ? 'Guardando...' : category ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
