# Auth Contract — User Object

## Login Response

`POST /api/auth/login` returns:

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "roles": ["Admin"],
    "permissions": ["products:read", "products:write", "products:delete"]
  }
}
```

The JWT token is set as an HttpOnly cookie (`access_token`), not returned in the response body.

## Profile Response

`GET /api/auth/profile` returns:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "User Name",
  "roles": ["Admin"],
  "permissions": ["products:read", "products:write", "products:delete"]
}
```

## JWT Payload

```json
{
  "sub": "uuid",
  "email": "user@example.com",
  "name": "User Name",
  "roles": ["Admin"],
  "permissions": ["products:read", "products:write", "products:delete"]
}
```

## RBAC Convention

- `roles`: Array of role names (e.g., `['Admin']`, `['Gerente']`, `['Operator']`, `['Viewer']`)
- `permissions`: Flat array of permission strings (e.g., `['products:read', 'products:write', 'products:delete', 'users:read', 'users:write', 'audit:read']`)
- Frontend can use these directly for visibility decisions

## Implementation Notes

- Permissions are deduplicated via `Set` when a user has multiple roles with overlapping permissions
- Roles and permissions are resolved from the database at login and at profile lookup (not stored in the JWT alone — the JWT is validated against `isActive` in the DB)
- `validateUser()` and `getProfile()` return identical shapes: `{ id, email, name, roles, permissions }`
- The JWT strategy (`validate()`) passes through `{ sub, email, name, roles, permissions }` to the request context
