# Graph Report - grupo-security-office  (2026-09-09)

## Corpus Check
- 335 files · ~306,664 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2564 nodes · 6202 edges · 168 communities (116 shown, 47 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 270 edges (avg confidence: 0.8)
- Token cost: 45,000 input · 8,500 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 128
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 159
- Community 160
- Community 161
- Community 162
- Community 163
- Community 164
- Community 165

## God Nodes (most connected - your core abstractions)
1. `Roles()` - 122 edges
2. `AccessContext` - 88 edges
3. `@nestjs/common` - 80 edges
4. `CurrentUser` - 76 edges
5. `getApiErrorMessage()` - 67 edges
6. `ProductsService` - 63 edges
7. `PrismaService` - 56 edges
8. `@nestjs/swagger` - 52 edges
9. `react` - 45 edges
10. `SuppliersService` - 40 edges

## Surprising Connections (you probably didn't know these)
- `buildPrisma()` --calls--> `createPrismaMock()`  [EXTRACTED]
  src/backend/src/modules/listas/listas.service.spec.ts → src/backend/src/__test__/mocks/prisma.mock.ts
- `buildPrisma()` --calls--> `createPrismaMock()`  [EXTRACTED]
  src/backend/src/modules/suppliers/suppliers.service.spec.ts → src/backend/src/__test__/mocks/prisma.mock.ts
- `BulkDeleteModalProps` --references--> `Product`  [EXTRACTED]
  src/frontend/src/features/products/components/BulkDeleteModal.tsx → src/frontend/src/features/products/types/product.types.ts
- `ImportStepConfirm()` --indirect_call--> `fetchListas()`  [INFERRED]
  src/frontend/src/features/products/import/components/ImportStepConfirm.tsx → src/frontend/src/services/listas.service.ts
- `ImportStepDocumentar()` --indirect_call--> `fetchListas()`  [INFERRED]
  src/frontend/src/features/products/import/components/ImportStepDocumentar.tsx → src/frontend/src/services/listas.service.ts

## Import Cycles
- None detected.

## Communities (168 total, 47 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (58): @neondatabase/serverless, @nestjs/testing, @prisma/adapter-neon, mockAcl, mockAssignment, mockAudit, mockPrisma, AuditContext (+50 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (75): BulkDeleteModal(), ProductSpreadsheetTable(), usePriceLists(), useProductMutations(), getTransitionHttpStatus(), useBulkTransition(), useTransitionProduct(), effectiveLifecycleStatus() (+67 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (58): hasPersistedImportState(), canCreateLista(), canDeleteLista(), canManageListas(), AccesosTab(), AuditoriaTab(), CONFIG_CURRENCIES, ConfiguracionTab() (+50 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (46): Catch, cookie-parser, helmet, jest, @nestjs/cli, @nestjs/passport, @nestjs/schedule, @nestjs/schematics (+38 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (37): class-transformer, class-validator, @nestjs/swagger, ALLOWED_CURRENCIES, DeleteProductDto, ApiPropertyOptional, IsBoolean, IsOptional (+29 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (45): react-router-dom, @tanstack/react-query, zustand, App(), ProtectedRoute(), AdminLayout(), COMMERCIAL_TABS, CommercialLayout() (+37 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (43): ProductPagination(), ProductPaginationProps, ProductCard(), ProductCardProps, ProductFormModalProps, AccessIndicatorProps, ProductIndicators(), ProductIndicatorsProps (+35 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (38): react, SearchFilterBar(), SearchFilterBarProps, SearchFilterChip, SIDEBAR_ACCORDIONS, SidebarAccordionId, SidebarFilterSection, viewportIsDesktop() (+30 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (35): @nestjs/common, AppModule, Module, AclModule, Module, AssignmentsModule, Module, AuditModule (+27 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (44): canDeleteBrands(), canDeleteCategories(), canDeletePrices(), AUDIT_ACTIONS, AUDIT_ENTITIES, AuditLogEntry, AuditResponse, BrandModal() (+36 more)

### Community 10 - "Community 10"
Cohesion: 0.17
Nodes (23): CurrentUser, ListasPublicationController, ProductsController, ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery (+15 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (30): CategoriesController, ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, Body, Controller, Delete (+22 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (34): CreateUserDto, ApiProperty, ApiPropertyOptional, IsArray, IsBoolean, IsEmail, IsOptional, IsString (+26 more)

### Community 13 - "Community 13"
Cohesion: 0.06
Nodes (35): Badge(), BadgeProps, BadgeVariant, variantClasses, Card(), CardProps, elevatedClasses, paddingClasses (+27 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (3): AccessContext, ListasService, Injectable

### Community 15 - "Community 15"
Cohesion: 0.19
Nodes (18): Roles(), SuppliersController, ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags, Body (+10 more)

### Community 16 - "Community 16"
Cohesion: 0.10
Nodes (3): Cron, ProductsService, Injectable

### Community 17 - "Community 17"
Cohesion: 0.09
Nodes (22): bcrypt, @nestjs/config, @nestjs/jwt, @prisma/client, supertest, IS_PUBLIC_KEY, Public(), mockAuthService (+14 more)

### Community 18 - "Community 18"
Cohesion: 0.08
Nodes (25): BrandsController, ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags, Body (+17 more)

### Community 19 - "Community 19"
Cohesion: 0.07
Nodes (26): CreateRoleDto, ApiProperty, ApiPropertyOptional, IsArray, IsOptional, IsString, MinLength, ApiPropertyOptional (+18 more)

### Community 20 - "Community 20"
Cohesion: 0.10
Nodes (31): canDeletePurchaseOrders(), hasRole(), CreatePurchaseOrderModal(), PO_STATUS_LABELS, PO_TRANSITIONS, PoBadge(), poBadgeClasses(), PurchaseOrderDetailModal() (+23 more)

### Community 21 - "Community 21"
Cohesion: 0.06
Nodes (35): CreateProductDto, ApiProperty, ApiPropertyOptional, IsArray, IsBoolean, IsIn, IsISO8601, IsObject (+27 more)

### Community 22 - "Community 22"
Cohesion: 0.12
Nodes (29): baseNameFromFile(), buildUniqueCode(), CURRENCIES, ImportStepDocumentar(), slugify(), SupplierModal(), SupplierModalProps, canDeleteSuppliers() (+21 more)

### Community 23 - "Community 23"
Cohesion: 0.12
Nodes (29): PRODUCT_ACCESS_LEVELS, ProductAccessModal(), ProductAccessModalProps, canManageListaAccess(), assignmentErrorFallback(), AssignmentFormModal(), AssignmentsPage(), LEVEL_LABELS (+21 more)

### Community 24 - "Community 24"
Cohesion: 0.19
Nodes (17): Permissions(), ListasController, ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags, Body (+9 more)

### Community 25 - "Community 25"
Cohesion: 0.13
Nodes (20): Req, ImportController, ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiResponse (+12 more)

### Community 26 - "Community 26"
Cohesion: 0.14
Nodes (16): isNumericLike(), ParseNumericOptions, parseNumericValue(), capitalizeFirst(), deriveNameFromDescription(), escapeRegExp(), normalizeBrandName(), normalizeCategoryName() (+8 more)

### Community 27 - "Community 27"
Cohesion: 0.13
Nodes (8): @nestjs/core, @nestjs/platform-express, reflect-metadata, ROLES_KEY, RolesGuard, Injectable, JwtAuthGuard, Injectable

### Community 28 - "Community 28"
Cohesion: 0.12
Nodes (13): ASSIGNMENT_LEVELS, LEVEL_RANK, ROLE_ASSIGNMENT_PREFIX, AssignmentFixture, mockPrisma, PERMISSIONS_KEY, LEGACY_PERMISSION_ALIASES, PermissionsGuard (+5 more)

### Community 29 - "Community 29"
Cohesion: 0.12
Nodes (21): AssignmentsController, ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, Body, Controller, Delete (+13 more)

### Community 30 - "Community 30"
Cohesion: 0.11
Nodes (17): ALLOWED_BRAND_IMAGE_MIMETYPES, BrandsService, mockBrand, mockBrandWithCount, mockBrandWithProducts, mockFiles, mockPrisma, Injectable (+9 more)

### Community 31 - "Community 31"
Cohesion: 0.14
Nodes (12): generateSlug(), BatchError, BatchExecutionResult, ImportContext, NormalizedRow, PipelineError, PriceEntry, BatchConfig (+4 more)

### Community 32 - "Community 32"
Cohesion: 0.12
Nodes (15): STOCK_ADJUSTMENT_TYPES, SUPPLIER_STATUSES, PO_STATUSES, READ_ROLES, WRITE_ROLES, PO_STATUS_ROLES, PO_TRANSITIONS, ADMIN (+7 more)

### Community 33 - "Community 33"
Cohesion: 0.13
Nodes (10): CreatePriceListDto, ApiProperty, ApiPropertyOptional, IsBoolean, IsDateString, IsOptional, IsString, MinLength (+2 more)

### Community 34 - "Community 34"
Cohesion: 0.18
Nodes (14): PricesController, ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, Body, Controller, Delete (+6 more)

### Community 35 - "Community 35"
Cohesion: 0.15
Nodes (9): ImportService, Injectable, IvaMode, PipelineStage, CurrentPriceResult, ImportExecutionResult, ImportPreviewResult, ImportProgressResult (+1 more)

### Community 36 - "Community 36"
Cohesion: 0.13
Nodes (21): getStepState(), ImportStepper(), ImportStepperProps, STEP_ORDER, STEPS, IMPORT_WIZARD_STORAGE_KEY, ImportStore, initialMetadata (+13 more)

### Community 38 - "Community 38"
Cohesion: 0.11
Nodes (18): AuthController, ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, Body, Controller, Get (+10 more)

### Community 39 - "Community 39"
Cohesion: 0.16
Nodes (9): mockPrisma, ValidatedRow, ValidationError, ImportSourceAdapter, ParseResult, RawRow, RowValidatorService, Injectable (+1 more)

### Community 40 - "Community 40"
Cohesion: 0.08
Nodes (24): dependencies, bcrypt, class-transformer, class-validator, cookie-parser, helmet, @neondatabase/serverless, @nestjs/common (+16 more)

### Community 41 - "Community 41"
Cohesion: 0.08
Nodes (24): devDependencies, eslint, jest, @nestjs/cli, @nestjs/schematics, @nestjs/testing, prisma, supertest (+16 more)

### Community 42 - "Community 42"
Cohesion: 0.12
Nodes (23): Admin Bootstrap Script, Admin Comercial, Admin Comercial, Auth Module, auth-architecture.md, Consulta, Consulta, JWT + bcrypt (+15 more)

### Community 43 - "Community 43"
Cohesion: 0.16
Nodes (19): PriceComparisonSection(), CurrentPriceInfo, CurrentPriceResponseData, fetchCurrentPrices(), usePriceComparison(), computeDeltaPercent(), enrichWithCurrentPrices(), formatDeltaDisplay() (+11 more)

### Community 44 - "Community 44"
Cohesion: 0.17
Nodes (20): ColumnMappingDto, ExecuteImportDto, PreviewImportDto, SectionDecisionDto, ApiProperty, ApiPropertyOptional, IsArray, IsEnum (+12 more)

### Community 46 - "Community 46"
Cohesion: 0.13
Nodes (15): ALL_FIELDS, REQUIRED_FIELDS, SYSTEM_FIELD_LABELS, FIXED_VALUE_FIELDS, FIXED_VALUE_PLACEHOLDERS, REQUIRED_FIELDS, ALL_FIELDS, MappingLine() (+7 more)

### Community 47 - "Community 47"
Cohesion: 0.25
Nodes (7): ColumnMapping, ColumnMappingEntry, HeaderDetectionResult, MappingPreset, SystemField, ColumnMapperService, Injectable

### Community 48 - "Community 48"
Cohesion: 0.13
Nodes (12): AuditController, ApiBearerAuth, ApiOperation, ApiQuery, ApiTags, Controller, Get, Param (+4 more)

### Community 49 - "Community 49"
Cohesion: 0.11
Nodes (18): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, experimentalDecorators, forceConsistentCasingInFileNames, incremental (+10 more)

### Community 50 - "Community 50"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 51 - "Community 51"
Cohesion: 0.18
Nodes (3): normalizeLevel(), AssignmentsService, Injectable

### Community 52 - "Community 52"
Cohesion: 0.12
Nodes (16): autoprefixer, axios, postcss, react-dom, react-hook-form, react-router, tailwindcss, @types/react (+8 more)

### Community 53 - "Community 53"
Cohesion: 0.16
Nodes (10): RolesModule, Module, RolesService, mockGenericRole, mockGenericRoleWithUsers, mockPrisma, mockRole, mockRoleWithPermissions (+2 more)

### Community 54 - "Community 54"
Cohesion: 0.18
Nodes (14): PriceRow, ProductFormModal(), seedPrices(), Tab, tabs, deserializeSpecFields(), serializeSpecFields(), SpecEditor() (+6 more)

### Community 55 - "Community 55"
Cohesion: 0.21
Nodes (14): ImportStepConfirm(), ImportStepExecution(), ImportStepExecutionProps, ImportStepHeaders(), ImportStepMapping(), ImportWizard(), ImportWizardProps, STEP_LABELS (+6 more)

### Community 56 - "Community 56"
Cohesion: 0.13
Nodes (16): allowedActions, architecture-detailed.md, POST /products/bulk-transition, Publish Checklist, Etapa 8: FSM Legacy Removal, Cierre FSM Canónica, Product Lifecycle FSM, ARCHIVED State (+8 more)

### Community 57 - "Community 57"
Cohesion: 0.12
Nodes (15): ADMIN, AnyMock, assignments, buildPrisma(), COMERCIAL, EDIT_PRICES, EDITER, MANAGE_ACCESS (+7 more)

### Community 58 - "Community 58"
Cohesion: 0.13
Nodes (15): backend-architecture.md, Cookie Parser, DTOs y Validación, Dashboard Module, Helmet, Jest, NestJS, Rate Limiting (+7 more)

### Community 59 - "Community 59"
Cohesion: 0.19
Nodes (5): SchedulePublicationDto, ApiProperty, IsISO8601, IsNotEmpty, LifecycleStatus

### Community 60 - "Community 60"
Cohesion: 0.13
Nodes (15): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, postcss (+7 more)

### Community 61 - "Community 61"
Cohesion: 0.26
Nodes (4): HeaderDetectionConfig, FIELD_SYNONYMS, HeaderDetectorService, Injectable

### Community 62 - "Community 62"
Cohesion: 0.23
Nodes (10): formatDuration(), ImportStepResult(), ImportStepResultProps, ImportStepValidation(), ValidationRow(), ValidationRowProps, ValidationRowError, exportImportLog() (+2 more)

### Community 63 - "Community 63"
Cohesion: 0.15
Nodes (13): scripts, build, db:bootstrap:dev-admin, db:bootstrap:dev-rbac, db:generate, db:migrate, db:seed, db:studio (+5 more)

### Community 64 - "Community 64"
Cohesion: 0.23
Nodes (9): ACCEPTED_EXTENSIONS, ACCEPTED_TYPES, formatFileSize(), ImportStepUpload(), isValidFileType(), ParsedFile, useFileParser(), PreviewParams (+1 more)

### Community 65 - "Community 65"
Cohesion: 0.17
Nodes (12): ACL Levels (view/edit/manage), AclService, AssignmentsService, Audit commercial scope, D5: Apply ACL level (view/edit/manage), D6: Admin Comercial manages assignments, Price validation rules, PricesService (+4 more)

### Community 66 - "Community 66"
Cohesion: 0.17
Nodes (12): CreateSupplierDto, ApiProperty, ApiPropertyOptional, IsIn, IsNumber, IsObject, IsOptional, IsString (+4 more)

### Community 67 - "Community 67"
Cohesion: 0.20
Nodes (11): Brands Module, File Storage Migration, Files Module, GitHub Actions, graphify, Grupo Security Office, Neon Driver Adapter, Playwright (+3 more)

### Community 68 - "Community 68"
Cohesion: 0.18
Nodes (11): Dashboard.tsx Mejoras, Dashboard Trending Products, Frontend Components, React, React Query (TanStack Query), Tailwind CSS, TanStack Query, TypeScript (+3 more)

### Community 69 - "Community 69"
Cohesion: 0.18
Nodes (8): FilesController, ApiOperation, ApiResponse, ApiTags, Controller, Get, Param, Res

### Community 70 - "Community 70"
Cohesion: 0.18
Nodes (11): CreateListaDto, ApiProperty, ApiPropertyOptional, IsBoolean, IsEnum, IsISO8601, IsOptional, IsString (+3 more)

### Community 71 - "Community 71"
Cohesion: 0.18
Nodes (11): BulkTransitionProductDto, ApiProperty, ApiPropertyOptional, ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn (+3 more)

### Community 72 - "Community 72"
Cohesion: 0.16
Nodes (11): SpecType, BOOLEAN, NUMBER, SELECT, TEXT, UNIT, ApiPropertyOptional, IsBoolean (+3 more)

### Community 73 - "Community 73"
Cohesion: 0.18
Nodes (11): CreateEvaluationDto, ApiProperty, ApiPropertyOptional, IsISO8601, IsNumber, IsObject, IsOptional, IsString (+3 more)

### Community 74 - "Community 74"
Cohesion: 0.18
Nodes (11): ApiPropertyOptional, IsIn, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength (+3 more)

### Community 75 - "Community 75"
Cohesion: 0.24
Nodes (10): Auditoría Module, Purchase Order Module, PurchaseOrder Status Matrix, Purchase Orders Module, Purchase Orders Dashboard, Stock Module, Supplier Evaluation, Supplier ↔ Product Association (+2 more)

### Community 76 - "Community 76"
Cohesion: 0.22
Nodes (10): Catalog (legacy), D1: Lista is new entity, Incremento 0: Lista entity root, LISTA-GENERAL (default), Lista (entity root), ListaDetailPage, Price, PriceList (tier/tariff) (+2 more)

### Community 77 - "Community 77"
Cohesion: 0.20
Nodes (8): TransitionProductDto, ApiProperty, ApiPropertyOptional, IsBoolean, IsIn, IsISO8601, IsOptional, IsString

### Community 78 - "Community 78"
Cohesion: 0.20
Nodes (10): dependencies, axios, react, react-dom, react-hook-form, react-router, react-router-dom, @tanstack/react-query (+2 more)

### Community 79 - "Community 79"
Cohesion: 0.22
Nodes (9): ARCHIVED, DRAFT, Dual-Write, Legacy Columns, PUBLISHED, Product Lifecycle FSM, Etapa 8.1, Etapa 8.2 (+1 more)

### Community 80 - "Community 80"
Cohesion: 0.25
Nodes (9): Brand, Category, D2: One product per Lista, ImportMapping, Product, ProductDetailPage, ProductImage, Scheduler: handleLifecycleTick (+1 more)

### Community 81 - "Community 81"
Cohesion: 0.31
Nodes (7): ws, getWsUrl(), http, run(), extractAX(), send(), WebSocket

### Community 82 - "Community 82"
Cohesion: 0.22
Nodes (9): ApiPropertyOptional, IsBoolean, IsDateString, IsISO8601, IsOptional, IsString, IsUUID, MaxLength (+1 more)

### Community 83 - "Community 83"
Cohesion: 0.22
Nodes (9): CreatePriceDto, ApiProperty, ApiPropertyOptional, IsDateString, IsNumber, IsOptional, IsString, IsUUID (+1 more)

### Community 84 - "Community 84"
Cohesion: 0.22
Nodes (9): ProductQueryDto, ApiPropertyOptional, IsBoolean, IsNumber, IsOptional, IsString, Min, Type (+1 more)

### Community 85 - "Community 85"
Cohesion: 0.42
Nodes (7): createCorruptedBuffer(), createCsvBuffer(), createEmptyExcelBuffer(), createExcelBuffer(), createHikvisionMockExcel(), createHikvisionMockRows(), HIKVISION_MOCK_HEADERS

### Community 86 - "Community 86"
Cohesion: 0.22
Nodes (9): CreatePurchaseOrderDto, ApiProperty, ApiPropertyOptional, IsIn, IsObject, IsOptional, IsString, IsUUID (+1 more)

### Community 87 - "Community 87"
Cohesion: 0.22
Nodes (9): CreateStockDto, ApiProperty, ApiPropertyOptional, IsIn, IsInt, IsOptional, IsString, MaxLength (+1 more)

### Community 88 - "Community 88"
Cohesion: 0.44
Nodes (7): ImportStepSections(), ImportColumnValueInfo, buildSectionsFromValues(), detectSectionValues(), DistinctValue, normalizeSectionName(), fetchCategories()

### Community 89 - "Community 89"
Cohesion: 0.32
Nodes (8): Assignment (ACL), Purchase Order status, PurchaseOrder (PO), Role, Supplier, SupplierEvaluation, Supplier status, User

### Community 90 - "Community 90"
Cohesion: 0.32
Nodes (7): LEGACY_ROLE_MAPPING, main(), migrateLegacyRoles(), prisma, ROLE_DESCRIPTIONS, ROLE_PERMISSIONS, upsertRole()

### Community 91 - "Community 91"
Cohesion: 0.25
Nodes (8): ApiPropertyOptional, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, UpdatePriceDto

### Community 92 - "Community 92"
Cohesion: 0.25
Nodes (8): ApiPropertyOptional, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, UpdateStockDto

### Community 93 - "Community 93"
Cohesion: 0.29
Nodes (7): Batch Execution Isolation, Current Prices Batch Endpoint, Import Module, Import Session Persistence, Mapping Gate Fix, Name Fallback, data-migration-engineer

### Community 94 - "Community 94"
Cohesion: 0.33
Nodes (7): BulkDeleteModal (UI), Incremento: Clave por usuario, Master Key (global), Per-User Key (password), ProductFormModal (UI), ProductsService, UsersService

### Community 95 - "Community 95"
Cohesion: 0.29
Nodes (7): overrides, brace-expansion, glob, picomatch, qs, tar, tmp

### Community 96 - "Community 96"
Cohesion: 0.29
Nodes (7): CreateAssignmentDto, ApiProperty, ApiPropertyOptional, IsIn, IsOptional, IsString, IsUUID

### Community 97 - "Community 97"
Cohesion: 0.29
Nodes (7): BulkSchedulePublicationDto, ApiProperty, ArrayMaxSize, ArrayMinSize, IsArray, IsISO8601, IsNotEmpty

### Community 98 - "Community 98"
Cohesion: 0.29
Nodes (6): HikvisionAssetCandidate, HikvisionAssetType, HikvisionCatalogSource, HikvisionLookupResult, HikvisionLookupStatus, HikvisionProductCandidate

### Community 99 - "Community 99"
Cohesion: 0.29
Nodes (7): ApiProperty, ApiPropertyOptional, IsIn, IsOptional, IsString, MaxLength, UpdatePurchaseOrderStatusDto

### Community 101 - "Community 101"
Cohesion: 0.57
Nodes (5): MappingPresetManager(), useDeleteImportMapping(), useImportMappings(), useSaveImportMapping(), MappingPreset

### Community 102 - "Community 102"
Cohesion: 0.29
Nodes (3): Toast, ToastContext, ToastContextValue

### Community 103 - "Community 103"
Cohesion: 0.33
Nodes (6): JWT Authentication, Backend (NestJS), PostgreSQL, Frontend (React), Prisma Migrations, Prisma ORM

### Community 104 - "Community 104"
Cohesion: 0.33
Nodes (6): ColumnMapper Service, ExcelAdapter, extraAttributes JSON, HeaderDetector Service, ADR-001: Arquitectura Híbrida de Importación, Excel Import Pipeline

### Community 105 - "Community 105"
Cohesion: 0.33
Nodes (6): Comercial-Backend-Implementer, Coordinator: User + Claude Code, GS Frontend Implementer, Kilo Code, OpenCode, tech-lead-orchestrator

### Community 106 - "Community 106"
Cohesion: 0.33
Nodes (6): CommercialLayout (frontend), Deny-by-default authorization, Incremento 1: Gestión de Listas + ACL, Listas Module, ListasPage, Precios Module

### Community 107 - "Community 107"
Cohesion: 0.33
Nodes (5): @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, typescript-eslint

### Community 108 - "Community 108"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 109 - "Community 109"
Cohesion: 0.40
Nodes (5): computeLifecycle(), main(), ORDER, prisma, ProductRow

### Community 110 - "Community 110"
Cohesion: 0.40
Nodes (5): AuditLog, AuditPage, AuditService, Header Navigation, UsersPage

### Community 111 - "Community 111"
Cohesion: 0.40
Nodes (3): CANONICAL_ROLE_NAMES, ROLE_DESCRIPTIONS, ROLE_PERMISSIONS

### Community 112 - "Community 112"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 114 - "Community 114"
Cohesion: 0.50
Nodes (4): Branch Convention, Commit Format, Issue → PR → Merge → Handoff, Worktree Convention

### Community 115 - "Community 115"
Cohesion: 0.50
Nodes (3): ./tsconfig.json, exclude, extends

### Community 116 - "Community 116"
Cohesion: 0.83
Nodes (3): loadEnv(), main(), verifyAfter()

### Community 117 - "Community 117"
Cohesion: 0.67
Nodes (3): Delegation Contract, Executor Response Format, solution-architect

### Community 118 - "Community 118"
Cohesion: 0.67
Nodes (3): Global Permissions Matrix, RBAC Bootstrap Script, 5 RBAC Roles

### Community 119 - "Community 119"
Cohesion: 0.67
Nodes (3): Python, excel-mapping-architect, python-excel-toolsmith

## Knowledge Gaps
- **474 isolated node(s):** `config`, `$schema`, `collection`, `sourceRoot`, `deleteOutDir` (+469 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1083 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **47 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Roles()` connect `Community 15` to `Community 32`, `Community 34`, `Community 4`, `Community 10`, `Community 11`, `Community 12`, `Community 48`, `Community 18`, `Community 19`, `Community 53`, `Community 24`, `Community 25`, `Community 27`, `Community 28`, `Community 29`, `Community 30`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `@nestjs/common` connect `Community 8` to `Community 32`, `Community 0`, `Community 3`, `Community 4`, `Community 35`, `Community 39`, `Community 47`, `Community 17`, `Community 53`, `Community 57`, `Community 26`, `Community 27`, `Community 28`, `Community 61`, `Community 30`, `Community 31`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Why does `AccessContext` connect `Community 14` to `Community 32`, `Community 33`, `Community 34`, `Community 4`, `Community 37`, `Community 100`, `Community 10`, `Community 77`, `Community 45`, `Community 15`, `Community 16`, `Community 51`, `Community 24`, `Community 59`, `Community 28`, `Community 29`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `config`, `$schema`, `collection` to the rest of the system?**
  _474 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.03982892274792836 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05238095238095238 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06180733162830349 - nodes in this community are weakly interconnected._