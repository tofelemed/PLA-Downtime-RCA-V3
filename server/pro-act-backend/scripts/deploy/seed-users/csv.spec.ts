import { parseSeedUsers } from './csv';

const header = 'email,name,role,scope_role';

describe('parseSeedUsers', () => {
  it('parses rows and maps an empty scope_role to null', () => {
    const rows = parseSeedUsers(
      `${header}\nA@Example.invalid,Plant viewer,Analyst,viewer\nb@example.invalid,"Smith, Jo",Manager,\n`,
    );
    expect(rows).toEqual([
      {
        email: 'a@example.invalid',
        name: 'Plant viewer',
        role: 'Analyst',
        scopeRole: 'viewer',
      },
      {
        email: 'b@example.invalid',
        name: 'Smith, Jo',
        role: 'Manager',
        scopeRole: null,
      },
    ]);
  });

  it('rejects a bad e-mail with its line number', () => {
    expect(() =>
      parseSeedUsers(
        `${header}\na@example.invalid,A,Analyst,\nnot-an-email,B,Analyst,\n`,
      ),
    ).toThrow('line 3: invalid e-mail');
  });

  it('rejects an unknown scope_role', () => {
    expect(() =>
      parseSeedUsers(`${header}
a@example.invalid,A,Analyst,boss
`),
    ).toThrow('line 2: unknown scope_role "boss"');
  });

  it('rejects a duplicate e-mail', () => {
    expect(() =>
      parseSeedUsers(
        `${header}\na@example.invalid,A,Analyst,\nA@example.invalid,B,Analyst,\n`,
      ),
    ).toThrow('line 3: duplicate e-mail');
  });

  it('rejects an unknown role and a wrong header', () => {
    expect(() =>
      parseSeedUsers(`${header}\na@example.invalid,A,Boss,\n`),
    ).toThrow('line 2: unknown role');
    expect(() => parseSeedUsers('email,name\n')).toThrow('line 1: header');
  });
});
