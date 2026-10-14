import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

async function setup({ x = 28, serverX = 45, held = false } = {}) {
    let now = 1000;
    const events = [];
    const serverPlayer = { x: serverX, y: 0 };
    const item = { id: 1, state: held ? 'held' : 'ground', heldBy: held ? 'test' : null, x: 0, y: 0 };
    let pickedUp = false;
    const state = {
        game: { players: { test: { name: 'test', x, y: 0, width: 25, height: 25 } } },
        items: [item],
        lastHeldItemId: null,
        pendingPickupItemId: null,
        lastPickupRequestItemId: null,
        lastPickupRequestTime: 0,
        lastMovementUpdate: 950,
        lastOrbitUpdateTime: 1000,
        client: {
            emit(event, json) {
                const data = JSON.parse(json);
                events.push({ event, data });
                if (event === 'move') Object.assign(serverPlayer, { x: data.x, y: data.y });
                if (event === 'itemPickup' && Math.hypot(serverPlayer.x - item.x, serverPlayer.y - item.y) <= 30) {
                    pickedUp = true;
                }
            },
        },
    };
    const context = createContext({ performance: { now: () => now }, console: { log() {}, warn() {} } });
    const dependencies = {
        '../script.js': { naem: 'test', CANVAS_WIDTH: 1000, CANVAS_HEIGHT: 800 },
        './state.js': { state },
        './constants.js': { CAMERA_ZOOM: 1, GRENADE_PICKUP_RADIUS: 30, GRENADE_PROJECTILE_RADIUS: 8 },
        './utils.js': { checkCollision: () => false },
    };
    const source = await readFile(new URL('../public/script/game/grenades.js', import.meta.url), 'utf8');
    const module = new SourceTextModule(source, { context });
    await module.link(name => {
        const values = dependencies[name];
        return new SyntheticModule(Object.keys(values), function () {
            for (const [key, value] of Object.entries(values)) this.setExport(key, value);
        }, { context });
    });
    await module.evaluate();
    return {
        state, events,
        tick: () => module.namespace.handleGrenades({}, {}),
        setTime: value => { now = value; },
        pickedUp: () => pickedUp,
    };
}

test('first pickup succeeds even when the server position is still outside the radius', async () => {
    const game = await setup();
    game.tick();
    assert.deepEqual(game.events.map(event => event.event), ['move', 'itemPickup']);
    assert.deepEqual(game.events[0].data, { name: 'test', x: 28, y: 0 });
    assert.equal(game.pickedUp(), true);
    assert.equal(game.state.lastMovementUpdate, 1000);
});

test('pickup includes the position when the player stops inside the pickup radius', async () => {
    const game = await setup({ x: 0, serverX: 60 });
    game.tick();
    assert.equal(game.pickedUp(), true);
});

test('pending pickups stay throttled and retries refresh the position', async () => {
    const game = await setup();
    game.tick();
    game.setTime(1100);
    game.tick();
    assert.equal(game.events.length, 2);
    game.state.game.players.test.x = 10;
    game.setTime(1301);
    game.tick();
    assert.equal(game.events.length, 4);
    assert.deepEqual(game.events[2], { event: 'move', data: { name: 'test', x: 10, y: 0 } });
    assert.equal(game.events[3].event, 'itemPickup');
});

test('out of range players do not request pickups', async () => {
    const game = await setup({ x: 31 });
    game.tick();
    assert.deepEqual(game.events, []);
});

test('players already holding a grenade do not request another', async () => {
    const game = await setup({ held: true });
    game.tick();
    assert.deepEqual(game.events, []);
});
