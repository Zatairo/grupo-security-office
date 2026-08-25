const fs = require('fs');
const file = 'C:/Users/sopor/grupo-security-office/src/backend/src/modules/products/products.service.ts';
let c = fs.readFileSync(file, 'utf8');

// Remove MasterKey import
c = c.replace("import { MasterKeyService } from '../master-key/master-key.service';\n", '');

// Remove @Optional() private masterKey injection
c = c.replace(/\n\s+@Optional\(\)\s+private\s+masterKey\?: MasterKeyService,?/g, '');

// Remove Optional from imports if not used elsewhere
// (check first)

// Remove doTransition -> should be transition
c = c.replace(/\bdoTransition\b/g, 'transition');

// Remove the masterKey data-associated block (from "const [priceCount..." to "// Clave por usuario")
const impactStart = c.indexOf("const [priceCount, imageCount, stock, auditCount, purchaseOrders]");
const claveBefore = c.indexOf("// Clave por usuario", impactStart);
if (impactStart >= 0 && claveBefore >= impactStart) {
  c = c.substring(0, impactStart) + c.substring(claveBefore);
}

// Remove any remaining masterKey references in the remove method
c = c.replace(/const masterKey = dto\?\.masterKey;[\s\S]*?if \(impact\.length > 0\) \{[\s\S]*?\}\n/g, '');
c = c.replace(/if \(impact\.length > 0\) \{[\s\S]*?throw new ConflictException[\s\S]*?\}\n/g, '');

// Fix transition method - the 4th param 'internal' should be kept
// Check if transition method has internal param
if (c.includes('async transition(') && !c.includes('async transition(id: string, dto: TransitionProductDto, ctx?: AccessContext, internal = false')) {
  c = c.replace(
    'async transition(id: string, dto: TransitionProductDto, ctx?: AccessContext) {',
    'async transition(id: string, dto: TransitionProductDto, ctx?: AccessContext, internal = false) {'
  );
}

// Remove clave-related stuff in toggleVisibility/toggleActive
c = c.replace(/, ToggleProductDto/g, '');
c = c.replace(/ToggleProductDto,\s*/g, '');

fs.writeFileSync(file, c);
console.log('Applied all fixes');
console.log('Size:', c.length, 'chars');