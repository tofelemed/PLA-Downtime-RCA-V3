import { EventEmitter } from 'events';
import { DataSource } from 'typeorm';
import { installTenantSessionBinding } from './tenant-session-binding';

class TestClient extends EventEmitter {
  query = jest.fn<Promise<unknown>, [string]>().mockResolvedValue([]);
}

function checkoutFixture() {
  const client = new TestClient();
  const release = jest.fn<void, [unknown?]>();
  const driver = {
    obtainMasterConnection: (): Promise<
      [TestClient, (error?: unknown) => void]
    > => Promise.resolve([client, release]),
  };
  const dataSource = { driver } as unknown as DataSource;
  return { client, release, driver, dataSource };
}

describe('tenant session binding connection errors', () => {
  it('handles a disconnect during binding and discards the failed connection', async () => {
    const { client, release, driver, dataSource } = checkoutFixture();
    const failure = new Error('Connection terminated unexpectedly');
    let rejectBinding: (error: Error) => void = () => undefined;
    client.query.mockImplementation(
      () => new Promise((_, reject) => (rejectBinding = reject)),
    );
    installTenantSessionBinding(dataSource);

    const pending = driver.obtainMasterConnection();
    const rejected = expect(pending).rejects.toBe(failure);
    await Promise.resolve();
    expect(() => client.emit('error', failure)).not.toThrow();
    rejectBinding(failure);
    await rejected;

    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith(failure);
    expect(client.listenerCount('error')).toBe(0);
  });

  it('refuses a connection that emitted an error even if binding resolves', async () => {
    const { client, release, driver, dataSource } = checkoutFixture();
    const failure = new Error('Connection reset');
    client.query.mockImplementation(() => {
      client.emit('error', failure);
      return Promise.resolve([]);
    });
    installTenantSessionBinding(dataSource);

    await expect(driver.obtainMasterConnection()).rejects.toBe(failure);
    expect(release).toHaveBeenCalledWith(failure);
    expect(client.listenerCount('error')).toBe(0);
  });

  it('keeps the connection protected through handoff and removes its listener on release', async () => {
    const { client, release, driver, dataSource } = checkoutFixture();
    installTenantSessionBinding(dataSource);
    const [connection, returnToPool] = await driver.obtainMasterConnection();
    const failure = new Error('Connection lost during handoff');

    expect(connection).toBe(client);
    expect(() => client.emit('error', failure)).not.toThrow();
    returnToPool();

    expect(release).toHaveBeenCalledWith(failure);
    expect(client.listenerCount('error')).toBe(0);
  });

  it('binds a healthy checkout once and returns it without an error', async () => {
    const { client, release, driver, dataSource } = checkoutFixture();
    expect(installTenantSessionBinding(dataSource)).toBe(true);
    expect(installTenantSessionBinding(dataSource)).toBe(false);
    const [, returnToPool] = await driver.obtainMasterConnection();
    returnToPool();

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(
      "RESET ROLE; SELECT set_config('app.tenant_ids', '', false)",
    );
    expect(release).toHaveBeenCalledWith(undefined);
    expect(client.listenerCount('error')).toBe(0);
  });
});
