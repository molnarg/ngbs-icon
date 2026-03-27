import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isNgbsMacAddress } from './discovery';
import { connect } from './url';
import { NgbsIconServiceClient, parseNgbsResponse } from './service_client';

describe('isNgbsMacAddress', () => {
    it('recognises known NGBS MAC prefixes', () => {
        assert.ok(isNgbsMacAddress('66:55:44:00:01:AB'));
        assert.ok(isNgbsMacAddress('00:50:C2:FD:A1:23'));
        assert.ok(isNgbsMacAddress('00:50:C2:F2:71:FF'));
        assert.ok(isNgbsMacAddress('00:50:C2:DE:71:00'));
        assert.ok(isNgbsMacAddress('40:D8:55:0D:21:FF'));
        assert.ok(isNgbsMacAddress('E4:95:6E:5A:BC:DE'));
    });

    it('rejects non-NGBS MAC addresses', () => {
        assert.ok(!isNgbsMacAddress('AA:BB:CC:DD:EE:FF'));
        assert.ok(!isNgbsMacAddress('00:00:00:00:00:00'));
        assert.ok(!isNgbsMacAddress(''));
    });
});

describe('connect', () => {
    it('throws on unknown protocol', () => {
        assert.throws(() => connect('http://192.168.1.1'), /Unknown protocol/);
    });

    it('throws when SYSID is missing from service:// URL', () => {
        assert.throws(() => connect('service://192.168.1.1'), /SYSID not specified/);
    });

    it('returns an NgbsIconServiceClient for a valid service:// URL', () => {
        const client = connect('service://123456789@192.168.1.1');
        assert.ok(client instanceof NgbsIconServiceClient);
    });
});

describe('parseNgbsResponse', () => {
    it('parses a normal response unchanged', () => {
        const raw = JSON.stringify({ SYSID: 'ABC', DOWNLOAD: 0 });
        assert.deepEqual(parseNgbsResponse(raw), { SYSID: 'ABC', DOWNLOAD: 0 });
    });

    it('returns {} for an empty response', () => {
        assert.deepEqual(parseNgbsResponse(''), {});
    });

    it('fixes bare 0000 firmware values', () => {
        const raw = `{"SYSID":"*******",
 "DOWNLOAD":0,
 "ICON1":{"VER:":"126092000", "FIRMWARE":1079},
 "ICON2":{"VER:":"0", "FIRMWARE":0000},
 "ICON3":{"VER:":"0", "FIRMWARE":0000}
}`;
        const result = parseNgbsResponse(raw);
        assert.equal(result.ICON2.FIRMWARE, 0);
        assert.equal(result.ICON3.FIRMWARE, 0);
        assert.equal(result.ICON1.FIRMWARE, 1079);
        assert.equal(result.DOWNLOAD, 0);
    });

    it('does not alter 0000 that appears inside a string value', () => {
        const raw = '{"ID":"0000", "COUNT":0000}';
        const result = parseNgbsResponse(raw);
        assert.equal(result.ID, '0000');
        assert.equal(result.COUNT, 0);
    });

    it('does not corrupt valid numbers like 10000', () => {
        const raw = '{"A":10000, "B":0}';
        assert.deepEqual(parseNgbsResponse(raw), { A: 10000, B: 0 });
    });

    it('does not corrupt a string containing 0000', () => {
        const raw = '{"VER":"126092000", "FIRMWARE":0000}';
        const result = parseNgbsResponse(raw);
        assert.equal(result.VER, '126092000');
        assert.equal(result.FIRMWARE, 0);
    });

    it('does not corrupt a string value containing colon then 0000 followed by comma', () => {
        // "x:0000," — the comma would fool a naive regex lookahead
        const raw = '{"NOTE":"x:0000,y", "FIRMWARE":0000}';
        const result = parseNgbsResponse(raw);
        assert.equal(result.NOTE, 'x:0000,y');
        assert.equal(result.FIRMWARE, 0);
    });

    it('does not corrupt a string value containing colon then 0000 followed by space', () => {
        const raw = '{"NOTE":"x:0000 rest", "FIRMWARE":0000}';
        const result = parseNgbsResponse(raw);
        assert.equal(result.NOTE, 'x:0000 rest');
        assert.equal(result.FIRMWARE, 0);
    });

    it('does not corrupt a string value with escaped quote before colon then 0000', () => {
        const raw = '{"NOTE":"say \\"hi\\":0000 ok", "FIRMWARE":0000}';
        const result = parseNgbsResponse(raw);
        assert.equal(result.NOTE, 'say "hi":0000 ok');
        assert.equal(result.FIRMWARE, 0);
    });
});
