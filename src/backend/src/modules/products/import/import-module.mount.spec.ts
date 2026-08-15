import 'reflect-metadata';
import { ProductsModule } from '../products.module';
import { ImportModule } from './import.module';
import { AppModule } from '../../../app.module';

describe('ImportModule — Montaje en la aplicación', () => {
  it('ProductsModule importa ImportModule (ruta /api/products/import montada)', () => {
    const imports = Reflect.getMetadata('imports', ProductsModule) ?? [];
    expect(imports).toContain(ImportModule);
  });

  it('AppModule importa ProductsModule (que arrastra ImportModule al runtime)', () => {
    const imports = Reflect.getMetadata('imports', AppModule) ?? [];
    expect(imports).toContain(ProductsModule);
  });
});