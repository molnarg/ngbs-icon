import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isNgbsMacAddress } from './discovery';
import { connect } from './url';
import { NgbsIconServiceClient } from './service_client';

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
