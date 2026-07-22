# Modelo de Datos - Grupo Security

## Entidades

### Product
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sku VARCHAR(100) UNIQUE NOT NULL,
  category_id UUID REFERENCES categories(id),
  brand_id UUID REFERENCES brands(id),
  status VARCHAR(20) DEFAULT 'draft', -- draft, active, archived
  is_published BOOLEAN DEFAULT false,
  images JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Category
```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Brand
```sql
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  logo_url VARCHAR(500),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### PriceList
```sql
CREATE TABLE price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  currency VARCHAR(3) DEFAULT 'COP',
  valid_from DATE,
  valid_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Price
```sql
CREATE TABLE prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  price_list_id UUID REFERENCES price_lists(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'COP',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, price_list_id)
);
```

### User
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Role
```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  permissions JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### UserRole (pivot)
```sql
CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);
```

### AuditLog
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE
  entity VARCHAR(100) NOT NULL, -- product, category, etc.
  entity_id UUID NOT NULL,
  changes JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Relaciones

```
Category ──┬── Category (self-referencial: padre-hijo)
            │
Product ────┼── Category (muchos a uno)
            ├── Brand (muchos a uno)
            ├── Price (uno a muchos)
            └── AuditLog (uno a muchos)

Brand ──────── Product (uno a muchos)

PriceList ──── Price (uno a muchos)

User ─────┬── UserRole ──── Role (muchos a muchos)
          └── AuditLog (uno a muchos)

Role ───────── UserRole (uno a muchos)
```

## Índices Recomendados

```sql
-- Productos
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_published ON products(is_published);

-- Categorías
CREATE INDEX idx_categories_parent ON categories(parent_id);

-- Precios
CREATE INDEX idx_prices_product ON prices(product_id);
CREATE INDEX idx_prices_list ON prices(price_list_id);

-- Auditoría
CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_date ON audit_logs(created_at);
```

## Datos Iniciales (Seed)

### Roles
```json
[
  { "name": "Admin", "permissions": ["*"] },
  { "name": "Gerente", "permissions": ["products.*", "prices.*", "publish.*", "reports.*"] },
  { "name": "Operator", "permissions": ["products.read", "products.update", "prices.read"] },
  { "name": "Viewer", "permissions": ["products.read", "categories.read", "brands.read"] }
]
```

### Categorías Iniciales
```json
[
  { "name": "CCTV", "description": "Sistemas de videovigilancia" },
  { "name": "Alarmas", "description": "Sistemas de alarma" },
  { "name": "Control de Acceso", "description": "Control de acceso y attendance" },
  { "name": "Smart Home", "description": "Automatización del hogar" }
]
```
