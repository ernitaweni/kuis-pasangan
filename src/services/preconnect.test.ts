import { describe, expect, it } from 'vitest';
import { firebaseOrigins } from './preconnect';

describe('firebaseOrigins', () => {
  it('produksi: origin database lalu server login anonim', () => {
    expect(
      firebaseOrigins({
        useEmulators: false,
        databaseUrl:
          'https://kuis-pasangan-a1b2c-default-rtdb.asia-southeast1.firebasedatabase.app/',
      }),
    ).toEqual([
      'https://kuis-pasangan-a1b2c-default-rtdb.asia-southeast1.firebasedatabase.app',
      'https://identitytoolkit.googleapis.com',
    ]);
  });

  it('emulator: tidak ada preconnect', () => {
    expect(firebaseOrigins({ useEmulators: true, databaseUrl: 'https://x.example' })).toEqual([]);
  });

  it('URL database kosong atau tidak valid dilewati tanpa error', () => {
    expect(firebaseOrigins({ useEmulators: false, databaseUrl: undefined })).toEqual([
      'https://identitytoolkit.googleapis.com',
    ]);
    expect(firebaseOrigins({ useEmulators: false, databaseUrl: 'bukan url' })).toEqual([
      'https://identitytoolkit.googleapis.com',
    ]);
  });
});
