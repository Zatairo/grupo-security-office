import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateUserDto } from './update-user.dto';

describe('UpdateUserDto — supervisorId', () => {
  it('supervisorId: null pasa la validacion (quitar supervisor)', async () => {
    const dto = plainToInstance(UpdateUserDto, { supervisorId: null });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('supervisorId omitido (undefined) pasa la validacion', async () => {
    const dto = plainToInstance(UpdateUserDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('supervisorId con un UUID valido pasa la validacion', async () => {
    const dto = plainToInstance(UpdateUserDto, {
      supervisorId: '550e8400-e29b-41d4-a716-446655440000',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('supervisorId con un string que no es UUID falla la validacion', async () => {
    const dto = plainToInstance(UpdateUserDto, { supervisorId: 'no-es-un-uuid' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('supervisorId');
  });
});
