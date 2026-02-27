/**
 * Standalone manifest validation script.
 * Run: npm run validate:manifest
 * Exits with code 1 on failure (CI-friendly).
 */

import { loadAndValidateManifest } from './toolRegistry.js';

try {
    const { tools } = loadAndValidateManifest();

    console.log(`✅ Manifest validation passed`);
    console.log(`   Total tools: ${tools.length}`);
    console.log(`   Tier 0 (read-only): ${tools.filter(t => t.tier === 0).length}`);
    console.log(`   Tier 1 (write):     ${tools.filter(t => t.tier === 1).length}`);
    console.log(`   Tier 2 (destructive): ${tools.filter(t => t.tier === 2).length}`);

    // Additional checks
    const names = tools.map(t => t.name);
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    if (duplicates.length > 0) {
        console.error(`❌ Duplicate tool names found: ${duplicates.join(', ')}`);
        process.exit(1);
    }

    // Verify all tiers are valid
    const invalidTiers = tools.filter(t => ![0, 1, 2].includes(t.tier));
    if (invalidTiers.length > 0) {
        console.error(`❌ Invalid tier values: ${invalidTiers.map(t => `${t.name}=${t.tier}`).join(', ')}`);
        process.exit(1);
    }

    console.log(`\n   All checks passed. Manifest is ready for production.`);
    process.exit(0);
} catch (error: any) {
    console.error(`❌ Manifest validation failed: ${error.message}`);
    process.exit(1);
}
