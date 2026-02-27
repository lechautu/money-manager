import { describe, it, expect } from 'vitest';
import { loadAndValidateManifest, getTierForTool } from '../toolRegistry.js';

describe('Manifest Validation', () => {
    const { manifest, tools } = loadAndValidateManifest();

    it('should load manifest successfully', () => {
        expect(manifest).toBeDefined();
        expect(manifest.manifest_version).toBe('1.0');
        expect(manifest.app_name).toBe('Money Manager 2');
    });

    it('should have tools registered', () => {
        expect(tools.length).toBeGreaterThan(0);
    });

    it('should have no duplicate tool names', () => {
        const names = tools.map(t => t.name);
        const uniqueNames = new Set(names);
        expect(names.length).toBe(uniqueNames.size);
    });

    it('should have only valid tier values (0, 1, 2)', () => {
        for (const tool of tools) {
            expect([0, 1, 2]).toContain(tool.tier);
        }
    });

    it('should normalize empty parameters to object schema', () => {
        for (const tool of tools) {
            expect(tool.inputSchema).toHaveProperty('type', 'object');
            expect(tool.inputSchema).toHaveProperty('properties');
        }
    });

    it('should derive correct annotations for Tier 0 tools', () => {
        const tier0 = tools.filter(t => t.tier === 0);
        expect(tier0.length).toBeGreaterThan(0);
        for (const tool of tier0) {
            expect(tool.annotations.readOnlyHint).toBe(true);
            expect(tool.annotations.destructiveHint).toBe(false);
        }
    });

    it('should derive correct annotations for Tier 1 tools', () => {
        const tier1 = tools.filter(t => t.tier === 1);
        expect(tier1.length).toBeGreaterThan(0);
        for (const tool of tier1) {
            expect(tool.annotations.readOnlyHint).toBe(false);
            expect(tool.annotations.destructiveHint).toBe(false);
        }
    });

    it('should derive correct annotations for Tier 2 tools', () => {
        const tier2 = tools.filter(t => t.tier === 2);
        expect(tier2.length).toBeGreaterThan(0);
        for (const tool of tier2) {
            expect(tool.annotations.readOnlyHint).toBe(false);
            expect(tool.annotations.destructiveHint).toBe(true);
        }
    });
});

describe('getTierForTool', () => {
    const { tools } = loadAndValidateManifest();

    it('should return correct tier for known tools', () => {
        expect(getTierForTool(tools, 'get_accounts')).toBe(0);
        expect(getTierForTool(tools, 'create_account')).toBe(1);
        expect(getTierForTool(tools, 'delete_account')).toBe(2);
    });

    it('should return undefined for unknown tools', () => {
        expect(getTierForTool(tools, 'nonexistent_tool')).toBeUndefined();
    });
});
